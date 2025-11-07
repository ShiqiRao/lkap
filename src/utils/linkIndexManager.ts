import * as vscode from 'vscode';
import * as path from 'path';
import { LinkParser } from './linkParser';
import { FileUtils } from './fileUtils';
import { GlobalLinkReferencesImpl } from './globalLinkReferences';
import { ParsedLink, IndexStatus, LinkReference, GlobalLinkReferences } from '../types';

/**
 * Manages the index of links between notes
 * Tracks both forward links and backlinks
 */
export class LinkIndexManager {
  private static instance: LinkIndexManager;

  // Link maps for quick lookups
  private forwardLinks: Map<string, ParsedLink[]> = new Map(); // sourceFile -> outgoing links
  private backlinks: Map<string, ParsedLink[]> = new Map();    // targetFile -> incoming links

  // Global link references (metadata from all documents)
  private globalLinkReferences: GlobalLinkReferences = new GlobalLinkReferencesImpl();

  // Index status
  private indexStatus: IndexStatus = {
    isBuilding: false,
    lastBuildTime: null,
    totalFiles: 0,
    indexedFiles: 0
  };

  // Event emitters
  private _onIndexUpdated = new vscode.EventEmitter<{ complete: boolean }>();
  readonly onIndexUpdated = this._onIndexUpdated.event;

  private _onBacklinksChanged = new vscode.EventEmitter<string>();
  readonly onBacklinksChanged = this._onBacklinksChanged.event;

  /**
   * Get the singleton instance
   */
  static getInstance(): LinkIndexManager {
    if (!LinkIndexManager.instance) {
      LinkIndexManager.instance = new LinkIndexManager();
    }
    return LinkIndexManager.instance;
  }

  /**
   * Private constructor (singleton)
   */
  private constructor() {
    // Initialize the index
  }

  /**
   * Build the link index from scratch
   */
  async buildIndex(): Promise<void> {
    // Don't rebuild if already in progress
    if (this.indexStatus.isBuilding) {
      return;
    }

    try {
      this.indexStatus.isBuilding = true;
      this.indexStatus.indexedFiles = 0;
      this._onIndexUpdated.fire(); // Notify that indexing started

      // Clear existing index
      this.forwardLinks.clear();
      this.backlinks.clear();
      this.globalLinkReferences = new GlobalLinkReferencesImpl();

      console.log('Building index - Phase 1: Extracting link references...');

      // First pass: extract all link references from all documents
      await this.buildGlobalLinkReferences();

      console.log('Building index - Phase 2: Parsing links...');

      // Second pass: find all links using the global references
      const allLinks = await LinkParser.findAllLinksWithReferences(this.globalLinkReferences);

      // Process each link
      for (let i = 0; i < allLinks.length; i++) {
        const link = allLinks[i];
        this.addLinkToIndex(link);

        // Update progress every 10 files to avoid too many events
        if (i % 10 === 0) {
          this.indexStatus.indexedFiles = Math.min(i + 1, allLinks.length);
          this._onIndexUpdated.fire();
        }
      }

      // Finalize
      this.indexStatus.isBuilding = false;
      this.indexStatus.lastBuildTime = new Date();
      this.indexStatus.indexedFiles = allLinks.length;
      this.indexStatus.totalFiles = new Set(allLinks.map(link => link.sourceFile)).size;

      console.log(`Index built successfully: ${allLinks.length} links, ${this.indexStatus.totalFiles} files`);

      // Ensure final state is propagated
      this._onIndexUpdated.fire(); // Final notification
    } catch (error) {
      console.error('Error building link index:', error);
      this.indexStatus.isBuilding = false;
      throw error;
    } finally {
      this.indexStatus.isBuilding = false; // Ensure flag is cleared even on error
    }
  }


  /**
   * Add a link to the index
   * @param link The link to add
   */
  private addLinkToIndex(link: ParsedLink): void {
    // Skip links without a target
    if (!link.targetFile) {
      return;
    }

    // Normalize paths for consistent comparison
    const sourceFile = this.normalizePath(link.sourceFile);
    const targetFile = this.normalizePath(link.targetFile);

    // Update forward links
    if (!this.forwardLinks.has(sourceFile)) {
      this.forwardLinks.set(sourceFile, []);
    }
    this.forwardLinks.get(sourceFile)!.push(link);

    // Update backlinks
    if (!this.backlinks.has(targetFile)) {
      this.backlinks.set(targetFile, []);
    }
    this.backlinks.get(targetFile)!.push(link);
  }

  /**
   * Update links for a specific file
   * @param filePath The file path
   * @param document The document to parse
   */
  async updateLinksForFile(filePath: string, document?: vscode.TextDocument): Promise<void> {
    if (this.indexStatus.isBuilding) {
      // During global build, skip individual updates to avoid recursion
      return;
    }

    try {
      const normalizedPath = this.normalizePath(filePath);

      // Get the document if not provided
      if (!document) {
        document = await vscode.workspace.openTextDocument(filePath);
      }

      // Remove existing links for this file
      this.removeLinksForFile(normalizedPath);

      // Remove old references from this file
      this.globalLinkReferences.removeReferencesFromFile(document.uri.fsPath);

      // Update link references from this document
      const fileReferences = LinkParser.extractLinkReferencesFromDocument(document);

      // Add new references from this file
      for (const [name, reference] of fileReferences) {
        const enhancedReference: LinkReference = {
          ...reference,
          sourceFile: document.uri.fsPath
        };
        this.globalLinkReferences.addReference(enhancedReference);
      }

      // Parse and add new links using current global references
      const links = LinkParser.parseDocumentLinksWithReferences(document, this.globalLinkReferences);

      // Track affected target files to notify about backlink changes
      const affectedTargets = new Set<string>();

      for (const link of links) {
        // Add the link to the index
        this.addLinkToIndex(link);

        if (link.targetFile) {
          affectedTargets.add(this.normalizePath(link.targetFile));
        }
      }

      // Notify about backlink changes
      affectedTargets.forEach(targetFile => {
        this._onBacklinksChanged.fire(targetFile);
      });

      // Notify that index was updated
      this._onIndexUpdated.fire();
    } catch (error) {
      console.error(`Error updating links for ${filePath}:`, error);
    }
  }

  /**
   * Remove all links for a file
   * @param filePath The file path
   */
  removeLinksForFile(filePath: string): void {
    const normalizedPath = this.normalizePath(filePath);

    // Remove all outgoing links from this file
    if (this.forwardLinks.has(normalizedPath)) {
      const links = this.forwardLinks.get(normalizedPath)!;

      // Track affected target files to notify about backlink changes
      const affectedTargets = new Set<string>();

      // For each outgoing link, remove it from the target's backlinks
      for (const link of links) {
        if (link.targetFile) {
          const targetPath = this.normalizePath(link.targetFile);
          affectedTargets.add(targetPath);

          // Remove from backlinks
          if (this.backlinks.has(targetPath)) {
            const targetBacklinks = this.backlinks.get(targetPath)!;
            const updatedBacklinks = targetBacklinks.filter(
              bl => this.normalizePath(bl.sourceFile) !== normalizedPath
            );

            if (updatedBacklinks.length > 0) {
              this.backlinks.set(targetPath, updatedBacklinks);
            } else {
              this.backlinks.delete(targetPath);
            }
          }
        }
      }

      // Remove from forward links
      this.forwardLinks.delete(normalizedPath);

      // Remove link references from this file
      this.globalLinkReferences.removeReferencesFromFile(filePath);

      // Notify about backlink changes
      affectedTargets.forEach(targetFile => {
        this._onBacklinksChanged.fire(targetFile);
      });
    }

    // Remove all incoming links to this file (backlinks)
    if (this.backlinks.has(normalizedPath)) {
      const backlinksToThisFile = this.backlinks.get(normalizedPath)!;

      // For each file that links to this file, remove the link
      for (const link of backlinksToThisFile) {
        const sourcePath = this.normalizePath(link.sourceFile);

        if (this.forwardLinks.has(sourcePath)) {
          const sourceLinks = this.forwardLinks.get(sourcePath)!;
          const updatedLinks = sourceLinks.filter(
            fl => fl.targetFile && this.normalizePath(fl.targetFile) !== normalizedPath
          );

          if (updatedLinks.length > 0) {
            this.forwardLinks.set(sourcePath, updatedLinks);
          } else {
            this.forwardLinks.delete(sourcePath);
          }
        }
      }

      // Remove from backlinks
      this.backlinks.delete(normalizedPath);

      // Notify that this file's backlinks changed
      this._onBacklinksChanged.fire(normalizedPath);
    }

    // Notify that index was updated
    this._onIndexUpdated.fire();
  }

  /**
   * Get all backlinks for a file
   * @param filePath The file path
   * @returns Array of links pointing to this file
   */
  getBacklinks(filePath: string): ParsedLink[] {
    const normalizedPath = this.normalizePath(filePath);
    return this.backlinks.get(normalizedPath) || [];
  }

  /**
   * Get all outgoing links from a file
   * @param filePath The file path
   * @returns Array of links from this file
   */
  getOutgoingLinks(filePath: string): ParsedLink[] {
    const normalizedPath = this.normalizePath(filePath);
    return this.forwardLinks.get(normalizedPath) || [];
  }

  /**
   * Get the current index status
   */
  getIndexStatus(): IndexStatus {
    return { ...this.indexStatus };
  }

  /**
   * Check if a file exists in the index
   * @param filePath The file path
   */
  hasFile(filePath: string): boolean {
    const normalizedPath = this.normalizePath(filePath);
    return this.forwardLinks.has(normalizedPath) || this.backlinks.has(normalizedPath);
  }

  /**
   * Get global link references
   */
  getGlobalLinkReferences(): GlobalLinkReferences {
    return this.globalLinkReferences;
  }

  /**
   * Build global link references from all markdown files
   */
  private async buildGlobalLinkReferences(): Promise<void> {
    try {
      // Get all markdown files
      const mdFiles = await FileUtils.getMarkdownFiles();

      for (const fileUri of mdFiles) {
        try {
          const document = await vscode.workspace.openTextDocument(fileUri);
          const fileReferences = LinkParser.extractLinkReferencesFromDocument(document);

          // Add to global references
          for (const [name, reference] of fileReferences) {
            // 添加来源文件信息
            const enhancedReference: LinkReference = {
              ...reference,
              sourceFile: document.uri.fsPath
            };
            this.globalLinkReferences.addReference(enhancedReference);
          }
        } catch (error) {
          console.error(`Error extracting references from ${fileUri.fsPath}:`, error);
        }
      }

      const stats = (this.globalLinkReferences as GlobalLinkReferencesImpl).getStats();
      console.log(`Built global link references: ${stats.totalReferences} references, ${stats.conflicts} conflicts`);
    } catch (error) {
      console.error('Error building global link references:', error);
    }
  }

  /**
   * Normalize a file path for consistent comparison
   * @param filePath The file path to normalize
   */
  private normalizePath(filePath: string): string {
    // Normalize slashes and casing for path comparison
    return filePath.replace(/\\/g, '/').toLowerCase();
  }
}