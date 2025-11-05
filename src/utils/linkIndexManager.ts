import * as vscode from 'vscode';
import * as path from 'path';
import { LinkParser } from './linkParser';
import { ParsedLink, IndexStatus } from '../types';

/**
 * Manages the index of links between notes
 * Tracks both forward links and backlinks
 */
export class LinkIndexManager {
  private static instance: LinkIndexManager;

  // Link maps for quick lookups
  private forwardLinks: Map<string, ParsedLink[]> = new Map(); // sourceFile -> outgoing links
  private backlinks: Map<string, ParsedLink[]> = new Map();    // targetFile -> incoming links

  // Index status
  private indexStatus: IndexStatus = {
    isBuilding: false,
    lastBuildTime: null,
    totalFiles: 0,
    indexedFiles: 0
  };

  // Event emitters
  private _onIndexUpdated = new vscode.EventEmitter<void>();
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
      this._onIndexUpdated.fire(); // Notify that indexing started

      // Clear existing index
      this.forwardLinks.clear();
      this.backlinks.clear();

      // Find all links in the workspace
      const allLinks = await LinkParser.findAllLinks();

      // Update index status
      this.indexStatus.totalFiles = new Set(allLinks.map(link => link.sourceFile)).size;
      this.indexStatus.indexedFiles = 0;

      // Process each link
      for (const link of allLinks) {
        this.addLinkToIndex(link);

        // Update progress
        const indexedFiles = new Set(Array.from(this.forwardLinks.keys())).size;
        if (indexedFiles > this.indexStatus.indexedFiles) {
          this.indexStatus.indexedFiles = indexedFiles;
          this._onIndexUpdated.fire(); // Progress update
        }
      }

      // Finalize
      this.indexStatus.isBuilding = false;
      this.indexStatus.lastBuildTime = new Date();
      this.indexStatus.indexedFiles = this.indexStatus.totalFiles;

      // Notify that indexing is complete
      this._onIndexUpdated.fire();

      console.log(`Link index built with ${allLinks.length} links across ${this.indexStatus.totalFiles} files`);
    } catch (error) {
      this.indexStatus.isBuilding = false;
      console.error('Error building link index:', error);
      throw error;
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
    try {
      const normalizedPath = this.normalizePath(filePath);

      // Get the document if not provided
      if (!document) {
        document = await vscode.workspace.openTextDocument(filePath);
      }

      // Remove existing links for this file
      this.removeLinksForFile(normalizedPath);

      // Parse and add new links
      const links = LinkParser.parseDocumentLinks(document);

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
   * Normalize a file path for consistent comparison
   * @param filePath The file path to normalize
   */
  private normalizePath(filePath: string): string {
    // Normalize slashes and casing for path comparison
    return filePath.replace(/\\/g, '/').toLowerCase();
  }
}