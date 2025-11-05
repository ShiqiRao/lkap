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

    // Create decoration type for links
    this.linkDecorationType = vscode.window.createTextEditorDecorationType({
      color: '#4287f5', // Blue text
      textDecoration: 'underline',
      cursor: 'pointer'
    });

    // Update decorations when active editor changes
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        this.updateLinkDecorations(editor);
      }
    });

    // Update decorations when document is modified
    vscode.workspace.onDidChangeTextDocument(event => {
      if (vscode.window.activeTextEditor &&
          event.document === vscode.window.activeTextEditor.document) {
        this.updateLinkDecorations(vscode.window.activeTextEditor);
      }
    });

    // Initial update for current editor
    if (vscode.window.activeTextEditor) {
      this.updateLinkDecorations(vscode.window.activeTextEditor);
    }
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

    // Parse links in the document
    const links = LinkParser.parseDocumentLinks(editor.document);

    // Store active links for this document
    this.activeLinks.set(editor.document.uri.toString(), links);

    // Apply decorations
    const decorations = links.map(link => ({
      range: link.range,
      hoverMessage: this.getLinkHoverMessage(link)
    }));

    // Update decorations
    editor.setDecorations(this.linkDecorationType, decorations);

    // Update link index
    await this.linkManager.updateLinksForFile(editor.document.uri.fsPath, editor.document);
  }

  /**
   * Check if the cursor is over a link and handle click
   */
  private checkLinkUnderCursor(editor: vscode.TextEditor): void {
    const position = editor.selection.active;
    const docLinks = this.activeLinks.get(editor.document.uri.toString());

    if (!docLinks) {
      return;
    }

    // Find link at cursor position
    const linkAtCursor = docLinks.find(link => link.range.contains(position));

    if (linkAtCursor) {
      // Show hover message
      vscode.commands.executeCommand('editor.action.showHover');
    }
  }

  /**
   * Get hover message for a link
   */
  private getLinkHoverMessage(link: ParsedLink): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    // Add link target info
    if (link.targetFile) {
      const fileName = path.basename(link.targetFile);
      md.appendMarkdown(`[Open ${fileName}](command:lkap.handleLinkClick?${encodeURIComponent(JSON.stringify(link))})`);

      // Check if target exists
      if (fs.existsSync(link.targetFile)) {
        md.appendMarkdown(' (File exists)');
      } else {
        md.appendMarkdown(' (File will be created)');
      }
    } else {
      md.appendMarkdown('Unable to resolve link target');
    }

    return md;
  }

  /**
   * Provide hover information for a link
   */
  private provideLinkHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
    const docLinks = this.activeLinks.get(document.uri.toString());

    if (!docLinks) {
      return undefined;
    }

    // Find link at position
    const linkAtPosition = docLinks.find(link => link.range.contains(position));

    if (linkAtPosition) {
      return new vscode.Hover(this.getLinkHoverMessage(linkAtPosition), linkAtPosition.range);
    }

    return undefined;
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