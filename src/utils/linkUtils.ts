import * as vscode from 'vscode';
import { createHash } from 'crypto';
import { LinkInstance, LinkParseResult, LinkConfig } from '../types/index';

/**
 * Link parser utility for extracting wiki-style and markdown links from content
 * Handles both [[wikilink]] and [markdown](note) formats
 * Also extracts tags in #tag format
 */
export class LinkParser {
  // Regex patterns for different link types
  private static readonly WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  private static readonly MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
  private static readonly TAG_PATTERN = /(?:^|\s)#([\w-]+)/g;

  /**
   * Main entry point that orchestrates the parsing of links and tags from content
   * @param content The markdown content to parse
   * @param sourceFile The source file path (absolute)
   * @param config Optional link parsing configuration
   * @returns LinkParseResult containing links, tags, and any errors
   */
  static parseLinks(
    content: string,
    sourceFile: string,
    config?: Partial<LinkConfig>
  ): LinkParseResult {
    const errors: string[] = [];
    const links: LinkInstance[] = [];

    try {
      // Extract wiki-style links if enabled (default: true)
      if (config?.enableWikilinks !== false) {
        const wikiMatches = this.extractWikilinks(content);
        for (const match of wikiMatches) {
          try {
            const target = match[1].trim();
            const display = (match[2] || match[1]).trim();

            // Skip empty links
            if (!target) {
              errors.push(`Empty wikilink found at position ${match.index}`);
              continue;
            }

            const normalizedTarget = this.normalizeLinkTarget(target);
            const range = this.getMatchRange(content, match);

            links.push({
              title: target,
              sourceFile,
              targetFile: null,
              range,
              format: 'wikilink',
              targetExists: false,
              displayText: display
            });
          } catch (err: any) {
            errors.push(`Failed to parse wikilink: ${err.message}`);
          }
        }
      }

      // Extract markdown links if enabled (default: true)
      if (config?.enableMarkdownLinks !== false) {
        const markdownMatches = this.extractMarkdownLinks(content);
        for (const match of markdownMatches) {
          try {
            const display = match[1].trim();
            const target = match[2].trim();

            // Skip empty links
            if (!target) {
              errors.push(`Empty markdown link found at position ${match.index}`);
              continue;
            }

            // Skip anchor-only links (e.g., (#), (#section))
            if (target.startsWith('#')) {
              continue;
            }

            // Skip external URLs (http://, https://, etc.)
            if (/^https?:\/\//i.test(target) || /^mailto:/i.test(target)) {
              continue;
            }

            const normalizedTarget = this.normalizeLinkTarget(target);
            const range = this.getMatchRange(content, match);

            links.push({
              title: normalizedTarget,
              sourceFile,
              targetFile: null,
              range,
              format: 'markdown',
              targetExists: false,
              displayText: display
            });
          } catch (err: any) {
            errors.push(`Failed to parse markdown link: ${err.message}`);
          }
        }
      }

      // Extract tags
      const tags = this.extractTags(content);

      return {
        links,
        tags,
        errors
      };
    } catch (error: any) {
      return {
        links: [],
        tags: [],
        errors: [`Critical parsing error: ${error.message}`]
      };
    }
  }

  /**
   * Extracts all wiki-style links from content
   * Matches: [[note]] or [[note|Display Text]]
   * @param content The markdown content to parse
   * @returns Array of regex matches with capture groups
   */
  static extractWikilinks(content: string): RegExpMatchArray[] {
    const matches: RegExpMatchArray[] = [];
    const pattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let match: RegExpMatchArray | null;

    while ((match = pattern.exec(content)) !== null) {
      matches.push(match);
    }

    return matches;
  }

  /**
   * Extracts all markdown-style links from content
   * Matches: [text](target) or [text](target.md)
   * @param content The markdown content to parse
   * @returns Array of regex matches with capture groups
   */
  static extractMarkdownLinks(content: string): RegExpMatchArray[] {
    const matches: RegExpMatchArray[] = [];
    const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match: RegExpMatchArray | null;

    while ((match = pattern.exec(content)) !== null) {
      matches.push(match);
    }

    return matches;
  }

  /**
   * Extracts all tags from content
   * Matches: #tag or #multi-word-tag (at word boundaries)
   * @param content The markdown content to parse
   * @returns Array of unique tag names (lowercase)
   */
  static extractTags(content: string): string[] {
    const tagSet = new Set<string>();
    const pattern = /(?:^|\s)#([\w-]+)/g;
    let match: RegExpMatchArray | null;

    while ((match = pattern.exec(content)) !== null) {
      const tag = match[1].toLowerCase();
      if (tag) {
        tagSet.add(tag);
      }
    }

    return Array.from(tagSet).sort();
  }

  /**
   * Normalizes a link target into a standard file format
   * Examples:
   * - "My Note" -> "my-note.md"
   * - "TODO" -> "todo.md"
   * - "my-note.md" -> "my-note.md"
   * @param linkText The link text to normalize
   * @returns Normalized file name with .md extension
   */
  static normalizeLinkTarget(linkText: string): string {
    // Remove leading/trailing whitespace
    let normalized = linkText.trim();

    // Convert to lowercase
    normalized = normalized.toLowerCase();

    // Replace spaces and multiple hyphens with single hyphen
    normalized = normalized.replace(/[\s_]+/g, '-');

    // Remove any trailing hyphens (from multiple spaces)
    normalized = normalized.replace(/-+$/g, '');

    // Ensure .md extension
    if (!normalized.endsWith('.md')) {
      normalized = `${normalized}.md`;
    }

    return normalized;
  }

  /**
   * Creates a SHA256 hash of file content for change detection
   * @param content The file content to hash
   * @returns Hex string representation of the hash
   */
  static hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Converts a character offset in content to a vscode.Position
   * Handles both CRLF and LF line endings
   * @param content The content string
   * @param offset The character offset from start
   * @returns vscode.Position with correct line and character
   */
  static getPositionFromOffset(content: string, offset: number): vscode.Position {
    let line = 0;
    let character = 0;

    for (let i = 0; i < offset && i < content.length; i++) {
      if (content[i] === '\n') {
        line++;
        character = 0;
      } else if (content[i] !== '\r') {
        // Skip carriage return; it doesn't count as a character position
        character++;
      }
    }

    return new vscode.Position(line, character);
  }

  /**
   * Helper method to convert a regex match to a vscode.Range
   * @param content The original content
   * @param match The regex match object with index
   * @returns vscode.Range covering the match
   */
  private static getMatchRange(content: string, match: RegExpMatchArray): vscode.Range {
    const startPos = this.getPositionFromOffset(content, match.index);
    const endPos = this.getPositionFromOffset(content, match.index + match[0].length);
    return new vscode.Range(startPos, endPos);
  }
}
