import * as vscode from 'vscode';
import { LinkResolver } from '../services/linkResolver';
import { LinkIndexService } from '../services/linkIndexService';
import { LinkInstance } from '../types/index';
import { FileUtils } from '../utils/fileUtils';
import { findLinkAtPosition } from '../commands/linkNavigation';

/**
 * LinkHoverProvider implements vscode.HoverProvider for markdown files
 * Shows preview information when hovering over links:
 * - Link target name
 * - Whether target exists
 * - Preview of first few lines (if exists)
 * - Candidates (if target not found)
 */
export class LinkHoverProvider implements vscode.HoverProvider {
  constructor(
    private linkResolver: LinkResolver,
    private linkIndexService: LinkIndexService
  ) {}

  /**
   * Provide hover information for a given position
   */
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    try {
      // Find link at position
      const link = findLinkAtPosition(document, position);
      if (!link) {
        return null;
      }

      // Resolve the link (synchronous operation)
      const resolution = this.linkResolver.resolveLink(link, document.uri.fsPath);

      // Create markdown content
      const md = new vscode.MarkdownString();
      md.isTrusted = true;

      if (resolution.exists && resolution.targetFile) {
        // Target exists - show preview with clickable open button
        md.appendMarkdown(`**${link.displayText}**\n\n`);

        try {
          const preview = await this.getFilePreview(resolution.targetFile, 3);
          if (preview) {
            md.appendMarkdown('```markdown\n');
            md.appendMarkdown(preview);
            md.appendMarkdown('\n```\n');
          } else {
            md.appendMarkdown('*(Empty file)*\n');
          }
        } catch (error) {
          md.appendMarkdown(`*(Failed to preview)*\n`);
        }

        // Format file path for display
        const displayPath = resolution.targetFile.replace(/\\/g, '/');
        md.appendMarkdown(`\n\`${displayPath}\`\n\n`);

        // Add clickable "Open" button
        const openCommand = this.createOpenFileCommand(resolution.targetFile);
        md.appendMarkdown(`[➡️ Open](${openCommand})`);
      } else {
        // Target doesn't exist
        md.appendMarkdown(`**${link.displayText}**\n\n`);
        md.appendMarkdown('*(Target not found)*\n\n');

        // Show clickable candidates if available
        if (resolution.candidates && resolution.candidates.length > 0) {
          md.appendMarkdown('**Candidates:**\n');
          for (const candidate of resolution.candidates.slice(0, 3)) {
            const title = candidate.metadata?.title || candidate.name;
            const openCommand = this.createOpenFileCommand(candidate.path);
            md.appendMarkdown(`- [${title}](${openCommand})\n`);
          }
          md.appendMarkdown('\n');
        } else {
          md.appendMarkdown('*No matching files found*\n\n');
        }

        // Add clickable "Create" button
        const createCommand = this.createCreateFileCommand(link);
        md.appendMarkdown(`[$(add) Create Note](${createCommand})`);
      }

      return new vscode.Hover([md]);
    } catch (error) {
      console.error('Error providing hover:', error);
      return null;
    }
  }

  /**
   * Get a preview of the first N lines from a file
   * @private
   */
  private async getFilePreview(filePath: string, lineCount: number = 3): Promise<string | null> {
    try {
      const content = await FileUtils.readFile(filePath);

      if (!content) {
        return null;
      }

      // Get first N lines
      const lines = content.split('\n').slice(0, lineCount);
      return lines.join('\n').trim();
    } catch (error) {
      console.error('Failed to get file preview:', error);
      return null;
    }
  }

  /**
   * Create a VSCode command URI for opening a file
   * Uses the vscode.open command with URI-encoded file path
   * @private
   */
  private createOpenFileCommand(filePath: string): string {
    const fileUri = vscode.Uri.file(filePath).toString();
    // Encode the URI as JSON, then URL-encode it for use in command link
    const encodedUri = encodeURIComponent(JSON.stringify(fileUri));
    return `command:vscode.open?${encodedUri}`;
  }

  /**
   * Create a VSCode command URI for creating a note from a link
   * Uses the lkap.createFromLink command with the LinkInstance as argument
   * @private
   */
  private createCreateFileCommand(link: LinkInstance): string {
    // Serialize the link to JSON and URL-encode it
    const encodedLink = encodeURIComponent(JSON.stringify(link));
    return `command:lkap.createFromLink?${encodedLink}`;
  }
}

/**
 * Register the link hover provider
 * Registers for markdown file type
 *
 * @param context VSCode extension context
 * @param linkResolver The LinkResolver service instance
 * @param linkIndexService The LinkIndexService instance
 */
export function registerLinkHoverProvider(
  context: vscode.ExtensionContext,
  linkResolver: LinkResolver,
  linkIndexService: LinkIndexService
): void {
  const provider = new LinkHoverProvider(linkResolver, linkIndexService);

  context.subscriptions.push(
    vscode.languages.registerHoverProvider('markdown', provider)
  );
}
