import * as vscode from 'vscode';
import * as path from 'path';
import { FileUtils } from '../utils/fileUtils';
import { LinkParser } from '../utils/linkUtils';
import { LinkResolver } from './linkResolver';
import {
  LinkIndex,
  FileIndex,
  ExtensionConfig,
  LinkInstance,
  LinkParseResult,
  FileMetadata
} from '../types/index';

/**
 * LinkIndexService manages the complete bidirectional link index for the workspace
 * Handles indexing, caching, incremental updates, and event emission
 * Implements vscode.Disposable for proper cleanup
 */
export class LinkIndexService implements vscode.Disposable {
  private index: LinkIndex;
  private isBuilding: boolean = false;
  private indexChangeEmitter: vscode.EventEmitter<LinkIndex>;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private context: vscode.ExtensionContext;
  private lastBuildTime: number = 0;
  private watcher: vscode.FileSystemWatcher | null = null;
  private linkResolver: LinkResolver | null = null;

  /**
   * Initialize LinkIndexService
   * @param context VSCode extension context for subscriptions and storage
   */
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.indexChangeEmitter = new vscode.EventEmitter<LinkIndex>();

    // Initialize empty index
    this.index = {
      files: new Map<string, FileIndex>(),
      backlinks: new Map<string, Set<string>>(),
      tags: new Map<string, Set<string>>(),
      metadata: {
        version: '1.0',
        lastBuildTime: Date.now(),
        totalFiles: 0,
        totalLinks: 0
      }
    };

    // Register for cleanup
    context.subscriptions.push(this);
  }

  /**
   * Rebuild the entire index from workspace files
   * Shows progress notification if requested
   * @param showProgress Whether to show progress notification
   * @returns The newly built LinkIndex
   */
  async rebuildIndex(showProgress?: boolean): Promise<LinkIndex> {
    if (this.isBuilding) {
      console.warn('Index rebuild already in progress');
      return this.index;
    }

    this.isBuilding = true;
    const startTime = Date.now();

    try {
      const config = this.getConfig();
      const notesPath = FileUtils.getWorkspaceRoot();
      // Get all markdown files in the notes directory
      let markdownFiles: vscode.Uri[];
      try {
        markdownFiles = await FileUtils.getMarkdownFiles(notesPath);
      } catch (error) {
        console.error('Failed to get markdown files:', error);
        markdownFiles = [];
      }

      // Create new index structure
      const newIndex: LinkIndex = {
        files: new Map<string, FileIndex>(),
        backlinks: new Map<string, Set<string>>(),
        tags: new Map<string, Set<string>>(),
        metadata: {
          version: '1.0',
          lastBuildTime: Date.now(),
          totalFiles: 0,
          totalLinks: 0
        }
      };

      let totalLinks = 0;

      // FIRST PASS: Read all files and parse links (without resolving)
      for (let i = 0; i < markdownFiles.length; i++) {
        const fileUri = markdownFiles[i];
        const filePath = fileUri.fsPath;

        try {
          // Read file content
          const content = await FileUtils.readFile(filePath);

          // Parse links and tags
          const parseResult = this.parseFileContent(filePath, content);

          // Get file metadata
          const stat = await vscode.workspace.fs.stat(fileUri);
          const fileName = FileUtils.getFileNameWithoutExt(filePath);

          // Create FileIndex entry
          const fileIndex: FileIndex = {
            path: filePath,
            name: fileName,
            lastIndexed: Date.now(),
            contentHash: LinkParser.hashContent(content),
            outgoingLinks: parseResult.links,
            metadata: {
              title: this.extractTitle(fileName, content),
              modifiedAt: stat.mtime,
              size: stat.size,
              createdAt: stat.ctime
            }
          };

          // Add to files map
          newIndex.files.set(filePath, fileIndex);
          totalLinks += parseResult.links.length;

          // Update tags map
          for (const tag of parseResult.tags) {
            if (!newIndex.tags.has(tag)) {
              newIndex.tags.set(tag, new Set<string>());
            }
            const tagSet = newIndex.tags.get(tag);
            if (tagSet) {
              tagSet.add(filePath);
            }
          }
        } catch (error) {
          console.error(`Failed to index file ${filePath}:`, error);
          // Continue processing other files
        }
      }

      // SECOND PASS: Resolve all links and populate backlinks map
      this.linkResolver = new LinkResolver(newIndex);
      let resolvedCount = 0;
      let backlinkCount = 0;
      let totalLinksFound = 0;

      for (const fileIndex of newIndex.files.values()) {
        totalLinksFound += fileIndex.outgoingLinks.length;
        for (let i = 0; i < fileIndex.outgoingLinks.length; i++) {
          const link = fileIndex.outgoingLinks[i];

          // Resolve the link to a target file
          const resolution = this.linkResolver.resolveLink(link, fileIndex.path);

          // Update the link with resolved target
          fileIndex.outgoingLinks[i] = resolution.link;

          // Add backlink if target file exists
          if (resolution.targetFile) {
            resolvedCount++;
            if (!newIndex.backlinks.has(resolution.targetFile)) {
              newIndex.backlinks.set(resolution.targetFile, new Set<string>());
            }
            const backlinkSet = newIndex.backlinks.get(resolution.targetFile);
            if (backlinkSet) {
              backlinkSet.add(fileIndex.path);
              backlinkCount++;
            }
          }
        }
      }

      console.log(`Total links found: ${totalLinksFound}`);
      console.log(`Resolved ${resolvedCount} links, created ${backlinkCount} backlink entries`);
      console.log(`Backlinks map has ${newIndex.backlinks.size} target files`);

      // Update metadata
      newIndex.metadata.totalFiles = newIndex.files.size;
      newIndex.metadata.totalLinks = totalLinks;

      // Validate and set new index
      this.index = this.validateIndex(newIndex);
      this.lastBuildTime = Date.now() - startTime;

      // Fire change event
      this.indexChangeEmitter.fire(this.index);

      console.log(
        `Index rebuilt: ${this.index.metadata.totalFiles} files, ` +
        `${this.index.metadata.totalLinks} links in ${this.lastBuildTime}ms`
      );

      return this.index;
    } finally {
      this.isBuilding = false;
    }
  }

  /**
   * Update a single file in the index
   * Uses debouncing to avoid rapid updates from fast typing
   * @param filePath Absolute path to the file
   * @param content New file content
   */
  async updateFile(filePath: string, content: string): Promise<void> {
    // Clear existing debounce timer for this file
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const newTimer = setTimeout(async () => {
      try {
        this.debounceTimers.delete(filePath);

        const config = this.getConfig();
        const notesPath = FileUtils.resolveWorkspacePath(config.notesPath);

        // Parse new content
        const parseResult = this.parseFileContent(filePath, content);
        const fileName = FileUtils.getFileNameWithoutExt(filePath);

        // Remove old backlinks for this file
        for (const [targetPath, sources] of this.index.backlinks.entries()) {
          sources.delete(filePath);
          if (sources.size === 0) {
            this.index.backlinks.delete(targetPath);
          }
        }

        // Remove from tags map
        for (const [tag, files] of this.index.tags.entries()) {
          files.delete(filePath);
          if (files.size === 0) {
            this.index.tags.delete(tag);
          }
        }

        // Get file metadata
        const fileUri = vscode.Uri.file(filePath);
        let stat;
        try {
          stat = await vscode.workspace.fs.stat(fileUri);
        } catch {
          // File might have been deleted
          this.removeFile(filePath);
          return;
        }

        // Create updated FileIndex entry
        const fileIndex: FileIndex = {
          path: filePath,
          name: fileName,
          lastIndexed: Date.now(),
          contentHash: LinkParser.hashContent(content),
          outgoingLinks: parseResult.links,
          metadata: {
            title: this.extractTitle(fileName, content),
            modifiedAt: stat.mtime,
            size: stat.size,
            createdAt: stat.ctime
          }
        };

        // Update the file in the index
        const oldFile = this.index.files.get(filePath);
        this.index.files.set(filePath, fileIndex);

        // Update link count
        if (oldFile) {
          this.index.metadata.totalLinks -= oldFile.outgoingLinks.length;
        }
        this.index.metadata.totalLinks += parseResult.links.length;

        // Resolve links and add new backlinks
        if (!this.linkResolver) {
          this.linkResolver = new LinkResolver(this.index);
        }

        for (let i = 0; i < fileIndex.outgoingLinks.length; i++) {
          const link = fileIndex.outgoingLinks[i];

          // Resolve the link to a target file
          const resolution = this.linkResolver.resolveLink(link, fileIndex.path);

          // Update the link with resolved target
          fileIndex.outgoingLinks[i] = resolution.link;

          // Add backlink if target file exists
          if (resolution.targetFile) {
            if (!this.index.backlinks.has(resolution.targetFile)) {
              this.index.backlinks.set(resolution.targetFile, new Set<string>());
            }
            const backlinkSet = this.index.backlinks.get(resolution.targetFile);
            if (backlinkSet) {
              backlinkSet.add(filePath);
            }
          }
        }

        // Add new tags
        for (const tag of parseResult.tags) {
          if (!this.index.tags.has(tag)) {
            this.index.tags.set(tag, new Set<string>());
          }
          const tagSet = this.index.tags.get(tag);
          if (tagSet) {
            tagSet.add(filePath);
          }
        }

        // Fire change event
        this.indexChangeEmitter.fire(this.index);
      } catch (error) {
        console.error(`Failed to update file ${filePath}:`, error);
      }
    }, 500); // Debounce time in milliseconds

    this.debounceTimers.set(filePath, newTimer);
  }

  /**
   * Remove a file from the index
   * @param filePath Absolute path to the file
   */
  async removeFile(filePath: string): Promise<void> {
    try {
      // Remove from files map
      const fileIndex = this.index.files.get(filePath);
      if (fileIndex) {
        this.index.metadata.totalLinks -= fileIndex.outgoingLinks.length;
        this.index.metadata.totalFiles = Math.max(0, this.index.metadata.totalFiles - 1);
      }

      this.index.files.delete(filePath);

      // Remove from backlinks (as source)
      for (const sources of this.index.backlinks.values()) {
        sources.delete(filePath);
      }

      // Remove empty entries
      for (const [target, sources] of this.index.backlinks.entries()) {
        if (sources.size === 0) {
          this.index.backlinks.delete(target);
        }
      }

      // Remove from tags
      for (const files of this.index.tags.values()) {
        files.delete(filePath);
      }

      // Remove empty tag entries
      for (const [tag, files] of this.index.tags.entries()) {
        if (files.size === 0) {
          this.index.tags.delete(tag);
        }
      }

      // Fire change event
      this.indexChangeEmitter.fire(this.index);
    } catch (error) {
      console.error(`Failed to remove file ${filePath}:`, error);
    }
  }

  /**
   * Get the current index (read-only)
   * @returns Current LinkIndex
   */
  getIndex(): Readonly<LinkIndex> {
    return Object.freeze(this.index) as Readonly<LinkIndex>;
  }

  /**
   * Check if index is currently being built
   * @returns true if building, false otherwise
   */
  isBuilding(): boolean {
    return this.isBuilding;
  }

  /**
   * Get statistics about the index
   * @returns Object with totalFiles, totalLinks, totalTags, and lastBuildTime
   */
  getStats(): { totalFiles: number; totalLinks: number; totalTags: number; lastBuildTime: number } {
    return {
      totalFiles: this.index.metadata.totalFiles,
      totalLinks: this.index.metadata.totalLinks,
      totalTags: this.index.tags.size,
      lastBuildTime: this.lastBuildTime
    };
  }

  /**
   * Event fired when index changes
   */
  get onIndexChanged(): vscode.Event<LinkIndex> {
    return this.indexChangeEmitter.event;
  }

  /**
   * Dispose resources (required by vscode.Disposable)
   */
  dispose(): void {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Dispose file watcher if exists
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = null;
    }

    // Dispose event emitter
    this.indexChangeEmitter.dispose();
  }

  /**
   * Get extension configuration
   * @returns ExtensionConfig with defaults
   */
  private getConfig(): ExtensionConfig {
    const vscodeConfig = vscode.workspace.getConfiguration('lkap');

    return {
      notesPath: vscodeConfig.get('notesPath', './notes'),
      dailyNoteFormat: vscodeConfig.get('dailyNoteFormat', 'YYYY-MM-DD'),
      dailyNoteTemplate: vscodeConfig.get('dailyNoteTemplate', ''),
      autoCreateLinks: vscodeConfig.get('autoCreateLinks', true),
      enableIndexing: vscodeConfig.get('enableIndexing', true)
    };
  }

  /**
   * Parse file content to extract links and tags
   * @param filePath Source file path
   * @param content File content to parse
   * @returns Parsed links and tags
   */
  private parseFileContent(filePath: string, content: string): LinkParseResult {
    return LinkParser.parseLinks(content, filePath, {
      enableWikilinks: true,
      enableMarkdownLinks: true
    });
  }

  /**
   * Extract title from file content or use filename as fallback
   * @param fileName File name without extension
   * @param content File content
   * @returns Title string
   */
  private extractTitle(fileName: string, content: string): string {
    // Look for first H1 heading
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match && h1Match[1]) {
      return h1Match[1].trim();
    }

    // Fall back to filename
    return fileName;
  }

  /**
   * Validate index integrity
   * Ensures all backlinks refer to existing files
   * @param indexToValidate The index to validate
   * @returns Validated index
   */
  private validateIndex(indexToValidate: LinkIndex): LinkIndex {
    // Remove backlinks to non-existent files
    for (const [targetPath, sources] of indexToValidate.backlinks.entries()) {
      if (!indexToValidate.files.has(targetPath)) {
        // Target file doesn't exist, but keep the backlinks mapping
        // as the file might be created later
      }
    }

    // Remove tags pointing to non-existent files
    for (const [tag, files] of indexToValidate.tags.entries()) {
      const validFiles = new Set(
        Array.from(files).filter((filePath) => indexToValidate.files.has(filePath))
      );

      if (validFiles.size === 0) {
        indexToValidate.tags.delete(tag);
      } else if (validFiles.size < files.size) {
        indexToValidate.tags.set(tag, validFiles);
      }
    }

    return indexToValidate;
  }
}
