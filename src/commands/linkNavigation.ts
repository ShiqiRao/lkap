import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LinkParser } from '../utils/linkParser';
import { FileUtils } from '../utils/fileUtils';
import { LinkIndexManager } from '../utils/linkIndexManager';
import { ParsedLink, ExtensionConfig } from '../types';

/**
 * Handles link navigation and related operations
 */
export class LinkNavigationManager {
  private context: vscode.ExtensionContext;
  private linkDecorationType: vscode.TextEditorDecorationType;
  private activeLinks: Map<string, ParsedLink[]> = new Map();
  private linkManager: LinkIndexManager;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.linkManager = LinkIndexManager.getInstance();

    // // Create decoration type for links
    // this.linkDecorationType = vscode.window.createTextEditorDecorationType({
    //   color: '#4287f5', // Blue text
    //   textDecoration: 'underline',
    //   cursor: 'pointer'
    // });

    // // Monitor index updates and refresh all open markdown editors
    // this.linkManager.onIndexUpdated(() => {
    //   // Force full re-parse for all visible markdown editors
    //   vscode.window.visibleTextEditors
    //     .filter(editor => editor.document.languageId === 'markdown')
    //     .forEach(editor => {
    //       this.activeLinks.delete(editor.document.uri.toString()); // Clear cache
    //       this.updateLinkDecorations(editor).catch(console.error);
    //     });
    // });

    // // Update decorations when active editor changes
    // vscode.window.onDidChangeActiveTextEditor(editor => {
    //   if (editor) {
    //     this.updateLinkDecorations(editor);
    //   }
    // });

    //Update decorations when document is modified
    vscode.workspace.onDidSaveTextDocument(event => {
      if (vscode.window.activeTextEditor &&
          event.document === vscode.window.activeTextEditor.document) {
        this.updateLinkDecorations(vscode.window.activeTextEditor);
      }
    });

    // // Delay initial update until index is ready
    // setTimeout(() => {
    //   if (vscode.window.activeTextEditor) {
    //     this.updateLinkDecorations(vscode.window.activeTextEditor);
    //   }
    // }, 2000); // Give initial index build time to complete
  }


  /**
   * Register link navigation commands
   */
  registerCommands(): void {
    // Register command to navigate to link at cursor
    this.context.subscriptions.push(
      vscode.commands.registerTextEditorCommand('lkap.followLink', (editor) => {
        this.followLinkAtCursor(editor);
      })
    );

    // Register click handler for links
    this.context.subscriptions.push(
      vscode.commands.registerCommand('lkap.handleLinkClick', (link: ParsedLink) => {
        this.navigateToLink(link);
      })
    );

    // Register hover provider for links
    this.context.subscriptions.push(
      vscode.languages.registerHoverProvider('markdown', {
        provideHover: (document, position) => {
          return this.provideLinkHover(document, position);
        }
      })
    );

    // Register click handler (via selection change)
    this.context.subscriptions.push(
      vscode.window.onDidChangeTextEditorSelection(event => {
        if (event.selections.length === 1 && event.selections[0].isEmpty) {
          this.checkLinkUnderCursor(event.textEditor);
        }
      })
    );
  }

  /**
   * Update link decorations in an editor
   */
  private async updateLinkDecorations(editor: vscode.TextEditor): Promise<void> {
    // Only decorate Markdown files
    if (editor.document.languageId !== 'markdown') {
      return;
    }

    const indexStatus = this.linkManager.getIndexStatus();

// If indexing is still building, delay decoration application
    if (indexStatus.isBuilding) {
      // Clear previous decorations and links
      this.activeLinks.delete(editor.document.uri.toString());
      editor.setDecorations(this.linkDecorationType, []);

      // Update index in background without waiting
      // this.linkManager.updateLinksForFile(editor.document.uri.fsPath, editor.document);
      return;
    }

    // Get global link references from the link manager
    const globalReferences = this.linkManager.getGlobalLinkReferences();

    // Parse links in the document using global references
    const links = LinkParser.parseDocumentLinksWithReferences(editor.document, globalReferences);

    // Store active links for this document
    this.activeLinks.set(editor.document.uri.toString(), links);

    // Apply decorations (only visual, no duplicate hover)
    const decorations = links.map(link => ({
      range: link.range
      // Remove hoverMessage to avoid duplication with language hover provider
    }));

    // Update decorations
    editor.setDecorations(this.linkDecorationType, decorations);

    // Update index in background if needed
    // Note: This is now handled separately to avoid blocking UI
    setTimeout(() => this.linkManager.updateLinksForFile(editor.document.uri.fsPath, editor.document), 0);
  }

  /**
   * Check if the cursor is over a link and handle click
   */
  private checkLinkUnderCursor(editor: vscode.TextEditor): void {
    const indexStatus = this.linkManager.getIndexStatus();

    // Show hover for indexing status or links
    if (indexStatus.isBuilding ||
        (indexStatus.lastBuildTime && this.activeLinks.has(editor.document.uri.toString()))) {
      vscode.commands.executeCommand('editor.action.showHover');
    }
  }

  /**
   * Get hover message for a link
   */
  private getLinkHoverMessage(link: ParsedLink, indexStatus?: any): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    if (link.targetFile) {
      const fileName = path.basename(link.targetFile);
      md.appendMarkdown(`[Open ${fileName}](command:lkap.handleLinkClick?${encodeURIComponent(JSON.stringify(link))})`);

      // Add link icon without file existence check to avoid blocking
      md.appendMarkdown(' 🔗');

      // Show target path for clarity
      md.appendMarkdown(`\n\nTarget: \`${link.targetFile}\``);
    } else {
      md.appendMarkdown('Unable to resolve link target');
    }

    return md;
  }

  /**
   * Provide hover information for a link
   */
  private provideLinkHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
    try {
      // Only parse the current line instead of the full document - critical performance fix
      const line = document.lineAt(position.line);
      const linksInLine = this.parseLinksInLine(line.text, position.line);

      const linkAtPosition = linksInLine.find(link => link.range.contains(position));

      if (linkAtPosition) {
        const md = this.getLinkHoverMessage(linkAtPosition);
        return new vscode.Hover(md, linkAtPosition.range);
      }

      return undefined;
    } catch (error) {
      console.warn('Error in provideLinkHover:', error);
      return undefined;
    }
  }

  /**
   * Parse links in a single line (optimized for hover performance)
   */
  private parseLinksInLine(lineText: string, lineNumber: number): ParsedLink[] {
    const links: ParsedLink[] = [];
    const config = this.getConfig();
    const notesPath = FileUtils.resolveWorkspacePath(config.notesPath);

    const wikiLinkPattern = /\[\[(.+?)(?:\|(.+?))?\]\]/g;
    let match;

    while ((match = wikiLinkPattern.exec(lineText)) !== null) {
      if (!match || !match[0]) continue; // Skip invalid matches

      const fullMatch = match[0];
      const linkText = match[1]?.trim() || '';

      // Calculate positions within the line
      const startColumn = match.index;
      const endColumn = match.index + fullMatch.length;
      const range = new vscode.Range(
        new vscode.Position(lineNumber, startColumn),
        new vscode.Position(lineNumber, endColumn)
      );

      // Optimized sanitization and target resolution
      const sanitizedName = linkText.replace(/[<>:"\\|?*]/g, '').replace(/\s+/g, ' ');
      const getBestMatch = this.linkManager.getGlobalLinkReferences().getBestMatch(sanitizedName);
      const targetFile = notesPath ? path.join(notesPath, `${sanitizedName}.md`) : '';

      links.push({
        title: match[2] || linkText,
        range: range,
        targetFile: targetFile,
        sourceFile: '' // Not needed for hover
      });
    }

    return links;
  }

  /**
   * Quick link parsing for hover (lightweight, local only)
   */
  private quickParseLinks(text: string, document: vscode.TextDocument): ParsedLink[] {
    const links: ParsedLink[] = [];

    // Use cached config - avoids repeated configuration lookups
    const config = this.getConfig();
    const notesPath = FileUtils.resolveWorkspacePath(config.notesPath);

    // Only parse the current line instead of the full document
    const lines = text.split('\n');
    const wikiLinkPattern = /\[\[(.+?)(?:\|(.+?))?\]\]/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes('[[')) {
        continue; // Skip lines without potential links
      }

      let match;
      let offset = 0;
      while ((match = wikiLinkPattern.exec(line.substring(offset))) !== null) {
        const fullMatch = match[0];
        const linkText = match[1].trim();

        const startColumn = line.indexOf(fullMatch, offset) + 2; // +2 for [[
        const endColumn = startColumn + fullMatch.length - 2; // -2 for ]]
        const range = new vscode.Range(
          new vscode.Position(i, startColumn),
          new vscode.Position(i, endColumn)
        );

        // Optimized sanitization and target resolution
        const sanitizedName = linkText.replace(/[<>:"\\|?*]/g, '').replace(/\s+/g, ' ');
        const targetFile = notesPath ? path.join(notesPath, `${sanitizedName}.md`) : '';

        links.push({
          title: match[2] || linkText,
          range: range,
          targetFile: targetFile,
          sourceFile: document.uri.fsPath
        });

        offset += match.index + fullMatch.length;
      }
    }

    return links;
  }

  /**
   * Simple target resolution for hover (no global references)
   */
  private simpleResolveTarget(linkText: string): string {
    try {
      const config = this.getConfig();
      const notesPath = FileUtils.resolveWorkspacePath(config.notesPath);
      const sanitizedName = linkText.trim().replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ');
      return path.join(notesPath, `${sanitizedName}.md`);
    } catch {
      return '';
    }
  }


  /**
   * Follow link at cursor position
   */
  private followLinkAtCursor(editor: vscode.TextEditor): void {
    const position = editor.selection.active;
    const docLinks = this.activeLinks.get(editor.document.uri.toString());

    if (!docLinks) {
      return;
    }

    // Find link at cursor position
    const linkAtCursor = docLinks.find(link => link.range.contains(position));

    if (linkAtCursor) {
      this.navigateToLink(linkAtCursor);
    } else {
      vscode.window.showInformationMessage('No link found at cursor position');
    }
  }

  /**
   * Navigate to a link target
   */
  private async navigateToLink(link: ParsedLink): Promise<void> {
    if (!link.targetFile) {
      vscode.window.showErrorMessage('Link target is empty or invalid');
      return;
    }

    try {
      // Get extension configuration
      const config = this.getConfig();

      // Check if target file exists
      const targetExists = await FileUtils.fileExists(link.targetFile);

      if (targetExists) {
        // Open existing file
        const document = await vscode.workspace.openTextDocument(link.targetFile);
        await vscode.window.showTextDocument(document);
      } else if (config.autoCreateLinks) {
        // Auto-create the file if configured
        const defaultContent = `# ${path.basename(link.targetFile, '.md')}\n\n`;
        await FileUtils.openOrCreateFile(link.targetFile, defaultContent);
        vscode.window.showInformationMessage(`Created new note: ${path.basename(link.targetFile)}`);
      } else {
        // Prompt to create
        const choice = await vscode.window.showInformationMessage(
          `Note "${path.basename(link.targetFile, '.md')}" does not exist. Create it?`,
          'Create',
          'Cancel'
        );

        if (choice === 'Create') {
          const defaultContent = `# ${path.basename(link.targetFile, '.md')}\n\n`;
          await FileUtils.openOrCreateFile(link.targetFile, defaultContent);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to navigate to link: ${error}`);
    }
  }

  /**
   * Get extension configuration
   */
  private getConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('lkap');
    return {
      notesPath: config.get<string>('notesPath', './notes'),
      dailyNoteFormat: config.get<string>('dailyNoteFormat', 'YYYY-MM-DD'),
      dailyNoteTemplate: config.get<string>('dailyNoteTemplate', ''),
      autoCreateLinks: config.get<boolean>('autoCreateLinks', true),
      enableIndexing: config.get<boolean>('enableIndexing', true)
    };
  }
}

/**
 * Register link navigation commands and features
 */
export function registerLinkNavigation(context: vscode.ExtensionContext): void {
  const linkNavigation = new LinkNavigationManager(context);
  linkNavigation.registerCommands();
}