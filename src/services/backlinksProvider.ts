import { LinkIndex, FileIndex, LinkInstance } from '../types/index';

/**
 * Validation report for link integrity
 */
export interface LinkValidationReport {
  /** Count of valid links to existing files */
  valid: number;

  /** Count of broken links to missing files */
  broken: number;

  /** Details about each broken link */
  details: Array<{
    source: string;
    target: string;
    link: LinkInstance;
  }>;
}

/**
 * BacklinksProvider provides query APIs for bidirectional links and graph operations
 * Supports efficient lookups, distance calculations, and graph traversals
 * All operations are optimized for fast performance with sub-5ms response times
 */
export class BacklinksProvider {
  private index: LinkIndex;
  private distanceCache: Map<string, Map<string, number>> = new Map();

  /**
   * Initialize BacklinksProvider with a LinkIndex
   * @param index The LinkIndex to query against
   */
  constructor(index: LinkIndex) {
    this.index = index;
  }

  /**
   * Get all files that link TO the given file
   * Returns all sources that have outgoing links pointing to the target
   *
   * @param filePath Absolute path to the target file
   * @returns Array of FileIndex objects that link to the given file
   *
   * @example
   * // If files A and B both link to C, calling getBacklinksFor(C) returns [A, B]
   * const backlinks = provider.getBacklinksFor('/path/to/file.md');
   */
  getBacklinksFor(filePath: string): FileIndex[] {
    if (!filePath) {
      return [];
    }

    // Lookup the backlinks set for this file
    const backlinkSources = this.index.backlinks.get(filePath);
    if (!backlinkSources || backlinkSources.size === 0) {
      return [];
    }

    // Convert to FileIndex array
    const result: FileIndex[] = [];
    for (const sourceFile of backlinkSources) {
      const fileIndex = this.index.files.get(sourceFile);
      if (fileIndex) {
        result.push(fileIndex);
      }
    }

    return result;
  }

  /**
   * Get all links FROM the given file
   * Returns all outgoing links in the specified file
   *
   * @param filePath Absolute path to the source file
   * @returns Array of LinkInstance objects from the given file
   *
   * @example
   * // If file A has links to B and C, calling getLinksFrom(A) returns [linkToB, linkToC]
   * const links = provider.getLinksFrom('/path/to/file.md');
   */
  getLinksFrom(filePath: string): LinkInstance[] {
    if (!filePath) {
      return [];
    }

    // Lookup the FileIndex for this file
    const fileIndex = this.index.files.get(filePath);
    if (!fileIndex) {
      return [];
    }

    return fileIndex.outgoingLinks;
  }

  /**
   * Calculate the shortest path distance between two files
   * Uses breadth-first search to find the minimum number of links needed
   * Treats the graph as bidirectional (considers both forward links and backlinks)
   *
   * @param fromFile Absolute path to the source file
   * @param toFile Absolute path to the target file
   * @returns Distance (number of hops), or -1 if no path exists
   *
   * @example
   * // If A->B->C, the distance from A to C is 2
   * const distance = provider.getDistance('/path/to/a.md', '/path/to/c.md');
   */
  getDistance(fromFile: string, toFile: string): number {
    if (!fromFile || !toFile) {
      return -1;
    }

    // Check cache first
    const cached = this.distanceCache.get(fromFile)?.get(toFile);
    if (cached !== undefined) {
      return cached;
    }

    // Same file has distance 0
    if (fromFile === toFile) {
      return 0;
    }

    // BFS to find shortest path
    const visited = new Set<string>();
    const queue: Array<{ file: string; distance: number }> = [
      { file: fromFile, distance: 0 }
    ];

    visited.add(fromFile);

    while (queue.length > 0) {
      const { file, distance } = queue.shift()!;

      // Get all neighbors (both forward links and backlinks)
      const neighbors = this.getNeighbors(file);

      for (const neighbor of neighbors) {
        if (neighbor === toFile) {
          // Found the target
          const result = distance + 1;
          this.cacheDistance(fromFile, toFile, result);
          return result;
        }

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ file: neighbor, distance: distance + 1 });
        }
      }
    }

    // No path found
    const result = -1;
    this.cacheDistance(fromFile, toFile, result);
    return result;
  }

  /**
   * Find all files connected to the given file within a maximum depth
   * Returns a map of file paths and their distances from the given file
   * Includes both forward links and backlinks
   *
   * @param filePath Absolute path to the source file
   * @param maxDepth Optional maximum depth to traverse (unlimited if not specified)
   * @returns Map of file paths to their distance from the source
   *
   * @example
   * // Get all files connected to A within 2 hops
   * const graph = provider.getConnectedGraph('/path/to/a.md', 2);
   * // Returns: Map { '/path/to/b.md' => 1, '/path/to/c.md' => 2 }
   */
  getConnectedGraph(filePath: string, maxDepth?: number): Map<string, number> {
    if (!filePath) {
      return new Map();
    }

    const result = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<{ file: string; distance: number }> = [
      { file: filePath, distance: 0 }
    ];

    visited.add(filePath);

    while (queue.length > 0) {
      const { file, distance } = queue.shift()!;

      // Skip the root file in results
      if (file !== filePath && (!maxDepth || distance <= maxDepth)) {
        result.set(file, distance);
      }

      // Continue traversal if within depth limit
      if (!maxDepth || distance < maxDepth) {
        const neighbors = this.getNeighbors(file);

        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push({ file: neighbor, distance: distance + 1 });
          }
        }
      }
    }

    return result;
  }

  /**
   * Find all files that contain broken (target not found) links
   * A broken link is one where the target file does not exist
   *
   * @returns Array of FileIndex objects that have broken links
   *
   * @example
   * // Get all files with missing link targets
   * const broken = provider.getFilesWithBrokenLinks();
   */
  getFilesWithBrokenLinks(): FileIndex[] {
    const result: FileIndex[] = [];

    for (const fileIndex of this.index.files.values()) {
      if (this.hasBrokenLinks(fileIndex)) {
        result.push(fileIndex);
      }
    }

    return result;
  }

  /**
   * Validate all links in the index and return a comprehensive report
   * Counts valid and broken links, and provides details on each broken link
   *
   * @returns LinkValidationReport with counts and details
   *
   * @example
   * // Get full validation report
   * const report = provider.validateLinks();
   * console.log(`Valid: ${report.valid}, Broken: ${report.broken}`);
   */
  validateLinks(): LinkValidationReport {
    let valid = 0;
    let broken = 0;
    const details: Array<{ source: string; target: string; link: LinkInstance }> = [];

    // Iterate through all files
    for (const fileIndex of this.index.files.values()) {
      // Check each outgoing link
      for (const link of fileIndex.outgoingLinks) {
        if (link.targetExists) {
          valid++;
        } else {
          broken++;
          details.push({
            source: fileIndex.path,
            target: link.targetFile || link.title,
            link
          });
        }
      }
    }

    return { valid, broken, details };
  }

  /**
   * Update the internal LinkIndex reference
   * Called when LinkIndexService rebuilds the index
   * Essential for keeping this provider synchronized with the index
   *
   * @param index The new LinkIndex to use
   */
  updateIndex(index: LinkIndex): void {
    this.index = index;
    // Clear distance cache when index changes
    this.distanceCache.clear();
  }

  /**
   * Get all neighbors of a file (both forward links and backlinks)
   * Neighbors are files directly connected to the given file
   * @private
   *
   * @param filePath Absolute path to the file
   * @returns Array of file paths that are neighbors
   */
  private getNeighbors(filePath: string): string[] {
    const neighbors: string[] = [];
    const seen = new Set<string>();

    // Forward links (outgoing)
    const fileIndex = this.index.files.get(filePath);
    if (fileIndex) {
      for (const link of fileIndex.outgoingLinks) {
        if (link.targetFile && !seen.has(link.targetFile)) {
          neighbors.push(link.targetFile);
          seen.add(link.targetFile);
        }
      }
    }

    // Backlinks (incoming)
    const backlinkSources = this.index.backlinks.get(filePath);
    if (backlinkSources) {
      for (const source of backlinkSources) {
        if (!seen.has(source)) {
          neighbors.push(source);
          seen.add(source);
        }
      }
    }

    return neighbors;
  }

  /**
   * Check if a file has any broken links
   * @private
   *
   * @param fileIndex The FileIndex to check
   * @returns true if file has broken links, false otherwise
   */
  private hasBrokenLinks(fileIndex: FileIndex): boolean {
    return fileIndex.outgoingLinks.some((link) => !link.targetExists);
  }

  /**
   * Cache a calculated distance for future queries
   * @private
   *
   * @param fromFile Source file path
   * @param toFile Target file path
   * @param distance Calculated distance
   */
  private cacheDistance(fromFile: string, toFile: string, distance: number): void {
    if (!this.distanceCache.has(fromFile)) {
      this.distanceCache.set(fromFile, new Map());
    }

    this.distanceCache.get(fromFile)!.set(toFile, distance);
  }
}
