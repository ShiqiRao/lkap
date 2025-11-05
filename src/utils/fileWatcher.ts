import * as vscode from 'vscode';
import * as path from 'path';
import { LinkIndexManager } from './linkIndexManager';
import { FileUtils } from './fileUtils';
import { ExtensionConfig } from '../types';

/**
 * Watches for file changes and updates the link index
 */
export class FileWatcher {
  private fileSystemWatcher: vscode.FileSystemWatcher | null = null;
  private linkManager: LinkIndexManager;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.linkManager = LinkIndexManager.getInstance();
    this.startWatching();
  }

  /**
   * Start watching for file changes
   */
  private startWatching(): void {
    try {
      // Create watcher for markdown files
      this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*.md');

      // Handle file creation
      this.fileSystemWatcher.onDidCreate(uri => {
        this.handleFileCreated(uri);
      });

      // Handle file changes
      this.fileSystemWatcher.onDidChange(uri => {
        this.handleFileChanged(uri);
      });

      // Handle file deletion
      this.fileSystemWatcher.onDidDelete(uri => {
        this.handleFileDeleted(uri);
      });

      // Handle file rename via workspace edit events
      vscode.workspace.onWillRenameFiles(e => {
        this.handleFilesRenamed(e);
      });

      // Register watcher for disposal
      this.context.subscriptions.push(this.fileSystemWatcher);

      console.log('File watcher started for markdown files');
    } catch (error) {
      console.error('Error starting file watcher:', error);
    }
  }

  /**
   * Handle file creation
   */
  private async handleFileCreated(uri: vscode.Uri): Promise<void> {
    try {
      // Only handle markdown files
      if (!this.isMarkdownFile(uri.fsPath)) {
        return;
      }

      // Process all markdown files in the workspace (not just notes directory)
      // This enables workspace-wide bidirectional linking

      console.log(`File created: ${uri.fsPath}`);

      // Open the document to parse links
      const document = await vscode.workspace.openTextDocument(uri);
      await this.linkManager.updateLinksForFile(uri.fsPath, document);
    } catch (error) {
      console.error(`Error handling file creation for ${uri.fsPath}:`, error);
    }
  }

  /**
   * Handle file changes
   */
  private async handleFileChanged(uri: vscode.Uri): Promise<void> {
    try {
      // Only handle markdown files
      if (!this.isMarkdownFile(uri.fsPath)) {
        return;
      }

      // Process all markdown files in the workspace (not just notes directory)
      // This enables workspace-wide bidirectional linking

      console.log(`File changed: ${uri.fsPath}`);

      // Open the document to parse links
      const document = await vscode.workspace.openTextDocument(uri);
      await this.linkManager.updateLinksForFile(uri.fsPath, document);
    } catch (error) {
      console.error(`Error handling file change for ${uri.fsPath}:`, error);
    }
  }

  /**
   * Handle file deletion
   */
  private handleFileDeleted(uri: vscode.Uri): void {
    try {
      // Only handle markdown files
      if (!this.isMarkdownFile(uri.fsPath)) {
        return;
      }

      // Process all markdown files in the workspace (not just notes directory)
      // This enables workspace-wide bidirectional linking

      console.log(`File deleted: ${uri.fsPath}`);

      // Remove file from the index
      this.linkManager.removeLinksForFile(uri.fsPath);
    } catch (error) {
      console.error(`Error handling file deletion for ${uri.fsPath}:`, error);
    }
  }

  /**
   * Handle file renaming
   */
  private handleFilesRenamed(event: vscode.FileWillRenameEvent): void {
    try {
      for (const { oldUri, newUri } of event.files) {
        // Only handle markdown files
        if (!this.isMarkdownFile(oldUri.fsPath) || !this.isMarkdownFile(newUri.fsPath)) {
          continue;
        }

        // Process all markdown files in the workspace (not just notes directory)
        // This enables workspace-wide bidirectional linking

        console.log(`File renamed: ${oldUri.fsPath} -> ${newUri.fsPath}`);

        // Remove old file from the index
        this.linkManager.removeLinksForFile(oldUri.fsPath);

        // New file will be handled by the change event
      }
    } catch (error) {
      console.error('Error handling file rename:', error);
    }
  }

  /**
   * Check if a file is a markdown file
   */
  private isMarkdownFile(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.md');
  }

  /**
   * Check if a file is in the notes directory
   */
  private isInNotesDirectory(filePath: string): boolean {
    try {
      const config = this.getConfig();
      const notesPath = FileUtils.resolveWorkspacePath(config.notesPath);

      // Check if the file is in the notes path
      const normalizedFile = filePath.replace(/\\/g, '/').toLowerCase();
      const normalizedNotesPath = notesPath.replace(/\\/g, '/').toLowerCase();

      return normalizedFile.startsWith(normalizedNotesPath);
    } catch (error) {
      console.error('Error checking if file is in notes directory:', error);
      return false;
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

  /**
   * Dispose the watcher
   */
  dispose(): void {
    if (this.fileSystemWatcher) {
      this.fileSystemWatcher.dispose();
      this.fileSystemWatcher = null;
    }
  }
}

/**
 * Set up the file watcher
 */
export function setupFileWatcher(context: vscode.ExtensionContext): FileWatcher {
  return new FileWatcher(context);
}