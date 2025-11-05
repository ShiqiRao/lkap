import * as vscode from 'vscode';
import * as path from 'path';
import { LinkIndexManager } from '../utils/linkIndexManager';
import { FileUtils } from '../utils/fileUtils';
import { ParsedLink } from '../types';

/**
 * TreeData provider for backlinks view
 * Shows all notes that link to the currently active document
 */
export class BacklinksViewProvider implements vscode.TreeDataProvider<BacklinkItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BacklinkItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private linkManager: LinkIndexManager;
  private activeDocumentPath: string | null = null;

  constructor() {
    this.linkManager = LinkIndexManager.getInstance();

    // Update the view when backlinks change
    this.linkManager.onBacklinksChanged(targetFile => {
      if (targetFile === this.activeDocumentPath) {
        this.refresh();
      }
    });

    // Update the view when the active editor changes
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && editor.document.languageId === 'markdown') {
        this.activeDocumentPath = editor.document.uri.fsPath;
        this.refresh();
      }
    });

    // Set initial active document
    if (vscode.window.activeTextEditor &&
        vscode.window.activeTextEditor.document.languageId === 'markdown') {
      this.activeDocumentPath = vscode.window.activeTextEditor.document.uri.fsPath;
    }
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Get tree item for a backlink
   */
  getTreeItem(element: BacklinkItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children of a tree item
   */
  getChildren(element?: BacklinkItem): Thenable<BacklinkItem[]> {
    if (!this.activeDocumentPath) {
      // No active document, show placeholder
      return Promise.resolve([
        new BacklinkItem(
          'No active markdown document',
          vscode.TreeItemCollapsibleState.None,
          {
            command: '',
            title: '',
            arguments: []
          }
        )
      ]);
    }

    if (element) {
      // No child items
      return Promise.resolve([]);
    } else {
      // Get backlinks for the active document
      const backlinks = this.linkManager.getBacklinks(this.activeDocumentPath);

      if (backlinks.length === 0) {
        // No backlinks, show placeholder
        return Promise.resolve([
          new BacklinkItem(
            'No backlinks found',
            vscode.TreeItemCollapsibleState.None,
            {
              command: '',
              title: '',
              arguments: []
            }
          )
        ]);
      }

      // Create tree items for each backlink
      return Promise.resolve(
        backlinks.map(link => {
          // Get file name for display
          const fileName = FileUtils.getFileNameWithoutExt(link.sourceFile);

          // Create tree item
          return new BacklinkItem(
            fileName,
            vscode.TreeItemCollapsibleState.None,
            {
              command: 'vscode.open',
              title: 'Open File',
              arguments: [vscode.Uri.file(link.sourceFile), { selection: link.range }]
            },
            link
          );
        })
      );
    }
  }

  /**
   * Register the view
   */
  static register(context: vscode.ExtensionContext): vscode.TreeView<BacklinkItem> {
    const provider = new BacklinksViewProvider();
    const view = vscode.window.createTreeView('lkap.backlinksView', {
      treeDataProvider: provider,
      showCollapseAll: false
    });

    // Register commands
    context.subscriptions.push(
      vscode.commands.registerCommand('lkap.refreshBacklinks', () => {
        provider.refresh();
      })
    );

    return view;
  }
}

/**
 * Tree item for backlinks view
 */
class BacklinkItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
    public readonly link?: ParsedLink
  ) {
    super(label, collapsibleState);

    // Set icon
    this.iconPath = new vscode.ThemeIcon('link');

    // Set tooltip
    if (link) {
      this.tooltip = `${link.sourceFile} -> ${link.targetFile}`;

      // Set description with link text if available
      if (link.title) {
        this.description = `"${link.title}"`;
      }
    }
  }

  // Context value for menu actions
  contextValue = 'backlink';
}