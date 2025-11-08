import * as vscode from 'vscode';
import { LinkIndexService } from '../services/linkIndexService';
import { LinkIndex } from '../types/index';

/**
 * TagItem represents a single tag in the tree view
 * Displays tag name with usage count
 */
export interface TagItem {
  tag: string;
  count: number;
  files: string[];
  collapsibleState: vscode.TreeItemCollapsibleState;
}

/**
 * TagFileItem represents a file associated with a tag
 * Used as child items in the tree hierarchy
 */
export interface TagFileItem {
  fileName: string;
  filePath: string;
  tag: string;
}

/**
 * TagsViewProvider implements vscode.TreeDataProvider for the tags sidebar view
 * Shows all unique tags found in indexed notes with usage counts
 * Allows users to click on tags to see associated files
 * Updates in real-time when the index changes
 */
export class TagsViewProvider implements vscode.TreeDataProvider<TagItem | TagFileItem> {
  private onDidChangeTreeDataEmitter = new vscode.EventEmitter<TagItem | TagFileItem | undefined>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private tags: TagItem[] = [];
  private index: LinkIndex;

  constructor(private linkIndexService: LinkIndexService) {
    // Get initial index
    this.index = linkIndexService.getIndex();
    this.updateTags();

    // Subscribe to index changes
    this.linkIndexService.onIndexChanged((newIndex: LinkIndex) => {
      this.index = newIndex;
      this.updateTags();
    });
  }

  /**
   * Get the tree item for a tag or file item
   */
  getTreeItem(element: TagItem | TagFileItem): vscode.TreeItem {
    // Handle TagFileItem (files within a tag)
    if ('filePath' in element && 'tag' in element) {
      const fileItem = element as TagFileItem;
      const item = new vscode.TreeItem(
        fileItem.fileName,
        vscode.TreeItemCollapsibleState.None
      );

      item.tooltip = fileItem.filePath;
      item.command = {
        command: 'vscode.open',
        title: 'Open file',
        arguments: [vscode.Uri.file(fileItem.filePath)]
      };

      // Use document icon for files
      item.iconPath = new vscode.ThemeIcon('document');

      return item;
    }

    // Handle TagItem (the tags themselves)
    const tagItem = element as TagItem;
    const item = new vscode.TreeItem(
      `${tagItem.tag}`,
      tagItem.collapsibleState
    );

    item.description = `(${tagItem.count})`;
    item.tooltip = `${tagItem.count} file${tagItem.count === 1 ? '' : 's'} with tag #${tagItem.tag}`;

    // Use tag icon
    item.iconPath = new vscode.ThemeIcon('tag');

    return item;
  }

  /**
   * Get children for a tree item
   * Returns files for a specific tag, or all tags if no element provided
   */
  getChildren(element?: TagItem | TagFileItem): (TagItem | TagFileItem)[] {
    // Root level: return all tags
    if (!element) {
      return this.tags;
    }

    // Files level: if this is a tag, return its files
    if ('tag' in element && !('filePath' in element)) {
      const tagItem = element as TagItem;
      return tagItem.files.map(filePath => {
        const fileName = this.getFileNameFromPath(filePath);
        return {
          fileName,
          filePath,
          tag: tagItem.tag,
          collapsibleState: vscode.TreeItemCollapsibleState.None
        } as TagFileItem;
      });
    }

    // Files have no children
    return [];
  }

  /**
   * Update the tags list from the current index
   * Extracts all unique tags and builds the tree structure
   * @private
   */
  private updateTags(): void {
    this.tags = [];

    try {
      const tagsMap = this.index.tags;

      // Convert tags map to TagItem array
      const tagItems: TagItem[] = Array.from(tagsMap.entries())
        .map(([tag, files]) => ({
          tag,
          count: files.size,
          files: Array.from(files).sort(), // Sort files alphabetically
          collapsibleState: files.size > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None
        }))
        .sort((a, b) => {
          // Sort tags alphabetically
          return a.tag.localeCompare(b.tag);
        });

      this.tags = tagItems;
    } catch (error) {
      console.error('Error updating tags:', error);
      this.tags = [];
    }

    // Notify view to update
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  /**
   * Extract file name from absolute file path
   * @private
   */
  private getFileNameFromPath(filePath: string): string {
    const parts = filePath.split(/[\\/]/);
    const fileName = parts[parts.length - 1];
    // Remove .md extension if present
    return fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
  }

  /**
   * Dispose of the provider
   */
  dispose(): void {
    this.onDidChangeTreeDataEmitter.dispose();
  }
}

/**
 * Register the tags view provider
 * The view ID 'lkap.tagView' is already registered in package.json
 *
 * @param context VSCode extension context
 * @param linkIndexService The LinkIndexService instance
 */
export function registerTagsViewProvider(
  context: vscode.ExtensionContext,
  linkIndexService: LinkIndexService
): TagsViewProvider {
  const viewProvider = new TagsViewProvider(linkIndexService);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('lkap.tagView', viewProvider)
  );
  context.subscriptions.push(viewProvider);
  return viewProvider;
}
