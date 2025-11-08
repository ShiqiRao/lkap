import * as path from 'path';
import { LinkIndex, FileIndex, LinkInstance, LinkResolution } from '../types/index';

/**
 * LinkResolver resolves link targets to actual files in the workspace
 * Implements a tiered matching strategy to handle:
 * - Exact matches (case-sensitive)
 * - Case-insensitive matches
 * - Fuzzy matches (handling typos)
 * - Substring matches
 * Caches results for performance
 */
export class LinkResolver {
  private index: LinkIndex;
  private matchCache: Map<string, FileIndex | null> = new Map();

  /**
   * Initialize LinkResolver with a LinkIndex
   * @param index The LinkIndex to use for resolving links
   */
  constructor(index: LinkIndex) {
    this.index = index;
  }

  /**
   * Resolve a link to its target file
   * Main entry point that applies the full matching strategy
   * @param link The link to resolve
   * @param sourceFile The source file containing the link (for context)
   * @returns LinkResolution with target file and candidates
   */
  resolveLink(link: LinkInstance, sourceFile: string): LinkResolution {
    // Normalize the link target
    const normalizedTarget = this.normalizeLinkTarget(link.title);

    // Check cache first
    const cacheKey = normalizedTarget;
    if (this.matchCache.has(cacheKey)) {
      const cached = this.matchCache.get(cacheKey);
      return {
        link: {
          ...link,
          targetFile: cached?.path ?? null,
          targetExists: cached !== null
        },
        targetFile: cached?.path ?? null,
        exists: cached !== null,
        candidates: this.getCandidates(link.title, 5)
      };
    }

    // Get source directory for relative context
    const sourceDir = path.dirname(sourceFile);

    // Get all files from index
    const allFiles = Array.from(this.index.files.values());

    // Find best match
    const bestMatch = this.findBestMatch(normalizedTarget, sourceDir, allFiles);

    // Update link with resolved target
    const resolvedLink: LinkInstance = {
      ...link,
      targetFile: bestMatch?.path ?? null,
      targetExists: bestMatch !== null
    };

    // Cache the result
    this.matchCache.set(cacheKey, bestMatch ?? null);

    // Return resolution
    return {
      link: resolvedLink,
      targetFile: bestMatch?.path ?? null,
      exists: bestMatch !== null,
      candidates: this.getCandidates(link.title, 5)
    };
  }

  /**
   * Find the best matching file for a link target
   * Uses tiered matching strategy:
   * 1. Exact match (case-sensitive)
   * 2. Case-insensitive match
   * 3. Fuzzy match (Levenshtein distance)
   * 4. Substring match
   * @param linkTarget The normalized link target (e.g., "my-note.md")
   * @param sourceDir Source directory (for relative context)
   * @param allFiles All files in the index
   * @returns The best FileIndex match or null
   */
  findBestMatch(linkTarget: string, sourceDir: string, allFiles: FileIndex[]): FileIndex | null {
    if (allFiles.length === 0) {
      return null;
    }

    // Try exact match first (fast path)
    for (const file of allFiles) {
      const fileName = path.basename(file.path);
      if (linkTarget === fileName) {
        return file;
      }
    }

    // Try case-insensitive match
    const lowerTarget = linkTarget.toLowerCase();
    for (const file of allFiles) {
      const fileName = path.basename(file.path).toLowerCase();
      if (lowerTarget === fileName) {
        return file;
      }
    }

    // Try fuzzy match (handles typos)
    let bestMatch: FileIndex | null = null;
    let bestDistance = 3; // Threshold for fuzzy matching

    for (const file of allFiles) {
      const fileName = path.basename(file.path).toLowerCase();
      const fileWithoutExt = fileName.replace(/\.md$/, '');
      const targetWithoutExt = lowerTarget.replace(/\.md$/, '');

      const distance = this.levenshteinDistance(lowerTarget, fileName);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = file;
      }

      // Also check without extension
      const distanceWithoutExt = this.levenshteinDistance(targetWithoutExt, fileWithoutExt);
      if (distanceWithoutExt < bestDistance) {
        bestDistance = distanceWithoutExt;
        bestMatch = file;
      }
    }

    if (bestMatch) {
      return bestMatch;
    }

    // Try substring match (files containing the target)
    for (const file of allFiles) {
      const fileName = path.basename(file.path).toLowerCase();
      if (fileName.includes(lowerTarget)) {
        return file;
      }
    }

    return null;
  }

  /**
   * Get top N candidate matches for a link target
   * Returns candidates in order of relevance
   * @param linkTarget The link target to find candidates for
   * @param limit Maximum number of candidates to return (default: 5)
   * @returns Array of FileIndex candidates sorted by relevance
   */
  getCandidates(linkTarget: string, limit: number = 5): FileIndex[] {
    const normalizedTarget = this.normalizeLinkTarget(linkTarget);
    const lowerTarget = normalizedTarget.toLowerCase();
    const targetWithoutExt = lowerTarget.replace(/\.md$/, '');

    const allFiles = Array.from(this.index.files.values());
    const scored: Array<{ file: FileIndex; score: number }> = [];

    for (const file of allFiles) {
      const fileName = path.basename(file.path).toLowerCase();
      const fileWithoutExt = fileName.replace(/\.md$/, '');

      let score = this.scoreMatch(lowerTarget, fileName, fileWithoutExt, targetWithoutExt);

      // Skip files with very low scores
      if (score > 0) {
        scored.push({ file, score });
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Return top N
    return scored.slice(0, limit).map((s) => s.file);
  }

  /**
   * Check if one file has a link to another file
   * @param linkFrom Source file path (absolute)
   * @param linkTo Target file path (absolute)
   * @returns true if linkFrom links to linkTo, false otherwise
   */
  isLinked(linkFrom: string, linkTo: string): boolean {
    const fileIndex = this.index.files.get(linkFrom);
    if (!fileIndex) {
      return false;
    }

    return fileIndex.outgoingLinks.some((link) => link.targetFile === linkTo);
  }

  /**
   * Get the specific link between two files
   * @param linkFrom Source file path (absolute)
   * @param linkTo Target file path (absolute)
   * @returns The LinkInstance if found, null otherwise
   */
  getLink(linkFrom: string, linkTo: string): LinkInstance | null {
    const fileIndex = this.index.files.get(linkFrom);
    if (!fileIndex) {
      return null;
    }

    const link = fileIndex.outgoingLinks.find((l) => l.targetFile === linkTo);
    return link ?? null;
  }

  /**
   * Update the internal index reference
   * Called when the index is rebuilt or changed
   * @param index The new LinkIndex
   */
  updateIndex(index: LinkIndex): void {
    this.index = index;
    // Clear cache when index updates
    this.matchCache.clear();
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Used for fuzzy matching to handle typos
   * @param str1 First string
   * @param str2 Second string
   * @returns Distance as a number (lower = more similar)
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialize first column
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    // Initialize first row
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2[i - 1] === str1[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Score a match for ranking candidates
   * Higher score = better match
   * @param target The normalized target (lowercase, with .md)
   * @param fileName Full file name (lowercase)
   * @param fileWithoutExt File name without extension (lowercase)
   * @param targetWithoutExt Target without extension (lowercase)
   * @returns Score as a number
   */
  private scoreMatch(
    target: string,
    fileName: string,
    fileWithoutExt: string,
    targetWithoutExt: string
  ): number {
    // Exact match: highest score
    if (target === fileName) {
      return 1000;
    }

    // Exact match without extension
    if (targetWithoutExt === fileWithoutExt) {
      return 950;
    }

    // Substring match at the start
    if (fileName.startsWith(target)) {
      return 500;
    }

    if (fileWithoutExt.startsWith(targetWithoutExt)) {
      return 450;
    }

    // Substring match anywhere
    if (fileName.includes(target)) {
      return 300;
    }

    if (fileWithoutExt.includes(targetWithoutExt)) {
      return 250;
    }

    // Fuzzy match based on Levenshtein distance
    const distance = this.levenshteinDistance(target, fileName);
    if (distance <= 3) {
      return Math.max(0, 100 - distance * 20);
    }

    // Fuzzy match without extension
    const distanceWithoutExt = this.levenshteinDistance(targetWithoutExt, fileWithoutExt);
    if (distanceWithoutExt <= 3) {
      return Math.max(0, 90 - distanceWithoutExt * 20);
    }

    // No match
    return 0;
  }

  /**
   * Normalize a link target to standard format
   * Removes .md extension if present (LinkParser already adds it)
   * @param linkTarget The raw link target
   * @returns Normalized target in lowercase
   */
  private normalizeLinkTarget(linkTarget: string): string {
    let normalized = linkTarget.trim().toLowerCase();

    // Already has .md extension from LinkParser, keep as-is
    if (!normalized.endsWith('.md')) {
      normalized = `${normalized}.md`;
    }

    return normalized;
  }
}
