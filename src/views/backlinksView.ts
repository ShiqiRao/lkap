import * as vscode from 'vscode';
import { BacklinksProvider } from '../services/backlinksProvider';
import { LinkIndexService } from '../services/linkIndexService';
import { FileIndex } from '../types/index';

/**
 * BacklinkItem represents a single backlink in the tree view
 */
export interface BacklinkItem {
  filePath: string;
  fileName: string;
  title: string;
  linkCount: number;
}

/**
 * BacklinksViewProvider implements vscode.TreeDataProvider for the backlinks sidebar view
 * Shows files that link to the currently active file
 * Updates in real-time when:
 * - Active editor changes
 * - Index changes (links added/removed)
 */
export class BacklinksViewProvider implements vscode.TreeDataProvider<BacklinkItem> {
  private onDidChangeTreeDataEmitter = new vscode.EventEmitter<BacklinkItem | undefined>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private currentFile: string | null = null;
  private backlinks: BacklinkItem[] = [];

  constructor(
    private backlinksProvider: BacklinksProvider,
    private linkIndexService: LinkIndexService
  ) {
    // Subscribe to editor changes
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      this.updateCurrentFile(editor?.document.uri.fsPath ?? null);
    });

    // Subscribe to index changes
    this.linkIndexService.onIndexChanged(() => {
      this.refreshBacklinks();
    });

    // Set initial file
    this.updateCurrentFile(vscode.window.activeTextEditor?.document.uri.fsPath ?? null);
  }

  /**
   * Get the tree item for a backlink item
   */
  getTreeItem(element: BacklinkItem): vscode.TreeItem {
    const item = new vscode.TreeItem(
      `${element.title || element.fileName}`,
      vscode.TreeItemCollapsibleState.None
    );

    item.description = `(${element.linkCount} ${element.linkCount === 1 ? 'link' : 'links'})`;
    item.tooltip = element.filePath;
    item.command = {
      command: 'vscode.open',
      title: 'Open file',
      arguments: [vscode.Uri.file(element.filePath)]
    };

    // Add icon
    item.iconPath = new vscode.ThemeIcon('link');

    return item;
  }

  /**
   * Get children for a tree item (in this flat structure, always empty)
   */
  getChildren(element?: BacklinkItem): BacklinkItem[] {
    if (element) {
      return [];
    }
    return this.backlinks;
  }

  /**
   * Update the current active file and refresh backlinks display
   */
  private updateCurrentFile(filePath: string | null): void {
    if (filePath === this.currentFile) {
      return;
    }

    this.currentFile = filePath;
    this.refreshBacklinks();
  }

  /**
   * Refresh the list of backlinks for the current file
   */
  private refreshBacklinks(): void {
    this.backlinks = [];

    if (!this.currentFile) {
      this.onDidChangeTreeDataEmitter.fire(undefined);
      return;
    }

    try {
      // Get backlinks for the current file
      const fileBacklinks = this.backlinksProvider.getBacklinksFor(this.currentFile);

      // Convert to BacklinkItems
      this.backlinks = fileBacklinks.map((fileIndex: FileIndex) => ({
        filePath: fileIndex.path,
        fileName: fileIndex.name,
        title: fileIndex.metadata?.title || fileIndex.name,
        linkCount: this.countLinksToCurrentFile(fileIndex)
      }));

      // Sort by title
      this.backlinks.sort((a, b) => a.title.localeCompare(b.title));
    } catch (error) {
      console.error('Error refreshing backlinks:', error);
      this.backlinks = [];
    }

    // Notify view to update
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  /**
   * Count how many links from a source file point to the current file
   * @private
   */
  private countLinksToCurrentFile(sourceFile: FileIndex): number {
    if (!this.currentFile) {
      return 0;
    }

    return sourceFile.outgoingLinks.filter((link) => link.targetFile === this.currentFile).length;
  }

  /**
   * Dispose of the provider
   */
  dispose(): void {
    this.onDidChangeTreeDataEmitter.dispose();
  }
}

/**
 * Register the backlinks view provider
 * The view ID 'lkap.backlinksView' is already registered in package.json
 *
 * @param context VSCode extension context
 * @param backlinksProvider The BacklinksProvider service instance
 * @param linkIndexService The LinkIndexService instance
 */
export function registerBacklinksViewProvider(
  context: vscode.ExtensionContext,
  backlinksProvider: BacklinksProvider,
  linkIndexService: LinkIndexService
): BacklinksViewProvider {
  const viewProvider = new BacklinksViewProvider(backlinksProvider, linkIndexService);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('lkap.backlinksView', viewProvider)
  );
  context.subscriptions.push(viewProvider);
  return viewProvider;
}
