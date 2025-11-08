import * as vscode from 'vscode';
import * as path from 'path';
import { LinkInstance } from '../types/index';
import { FileUtils } from '../utils/fileUtils';
import { LinkIndexService } from '../services/linkIndexService';

/**
 * Register the quick link create command
 * Command: lkap.createFromLink
 * Functionality:
 * - Create a new note from an unresolved link
 * - Support optional template usage
 * - Open the newly created note
 * - Trigger index update (or rely on file watcher)
 *
 * @param context VSCode extension context
 * @param linkIndexService The LinkIndexService instance for triggering updates
 */
export function registerQuickLinkCreateCommand(
  context: vscode.ExtensionContext,
  linkIndexService: LinkIndexService
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('lkap.createFromLink', async (link?: LinkInstance) => {
      try {
        if (!link) {
          vscode.window.showErrorMessage('No link provided for creation');
          return;
        }

        // Get workspace root
        const workspaceRoot = FileUtils.getWorkspaceRoot();

        // Get configuration
        const config = vscode.workspace.getConfiguration('lkap');
        const notesPath = config.get<string>('notesPath', './notes');
        const templatePath = config.get<string>('dailyNoteTemplate', '');

        // Resolve notes directory
        const notesDir = path.join(workspaceRoot, notesPath);

        // Ensure notes directory exists
        try {
          await FileUtils.ensureDir(notesDir);
        } catch (error) {
          console.error('Failed to create notes directory:', error);
          throw new Error(`Failed to create notes directory: ${error}`);
        }

        // Create file path
        const fileName = link.displayText.includes('.md') ? link.displayText : `${link.displayText}.md`;
        const filePath = path.join(notesDir, fileName);

        // Check if file already exists
        const fileUri = vscode.Uri.file(filePath);
        try {
          await vscode.workspace.fs.stat(fileUri);
          // File exists
          vscode.window.showInformationMessage(`Note already exists: ${fileName}`);
          const doc = await vscode.workspace.openTextDocument(fileUri);
          await vscode.window.showTextDocument(doc);
          return;
        } catch {
          // File doesn't exist, which is what we want
        }

        // Create file content
        let content = '';

        // Try to use template if configured
        if (templatePath) {
          try {
            const absoluteTemplatePath = path.join(workspaceRoot, templatePath);
            content = await FileUtils.readFile(absoluteTemplatePath);
          } catch (error) {
            console.warn('Failed to read template:', error);
            // Fall through to default content
          }
        }

        // If no template content or template not available, use default
        if (!content) {
          content = `# ${link.displayText}\n\n`;
        }

        // Write file
        const uint8Array = Buffer.from(content, 'utf8');
        await vscode.workspace.fs.writeFile(fileUri, uint8Array);

        // Trigger index rebuild to pick up new file
        // Use setTimeout to allow file system to settle
        setTimeout(async () => {
          try {
            await linkIndexService.rebuildIndex(false); // false = don't show progress
          } catch (error) {
            console.error('Failed to rebuild index after creating note:', error);
          }
        }, 500);

        // Open the newly created note
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage(`Created note: ${fileName}`);
      } catch (error) {
        console.error('Error creating note from link:', error);
        vscode.window.showErrorMessage(
          `Failed to create note: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );
}
