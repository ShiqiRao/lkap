import * as vscode from 'vscode';
import * as path from 'path';
import { LinkInstance, LinkResolution } from '../types/index';
import { LinkResolver } from '../services/linkResolver';
import { LinkParser } from '../utils/linkUtils';
import { FileUtils } from '../utils/fileUtils';

/**
 * Helper function to find a link at the given cursor position
 * Checks if cursor is inside [[wikilink]] or [markdown](link) format
 * Returns the LinkInstance or null if no link found at position
 *
 * @param document The active text document
 * @param position The cursor position to check
 * @returns LinkInstance if found, null otherwise
 */
export function findLinkAtPosition(
  document: vscode.TextDocument,
  position: vscode.Position
): LinkInstance | null {
  const line = document.lineAt(position.line);
  const text = line.text;
  const col = position.character;

  // Check for [[wikilink]] format
  const wikiPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let match;

  while ((match = wikiPattern.exec(text)) !== null) {
    const startCol = match.index;
    const endCol = match.index + match[0].length;

    if (col >= startCol && col <= endCol) {
      const linkTitle = match[1].trim();
      const displayText = (match[2] || match[1]).trim();

      const startPos = new vscode.Position(position.line, startCol + 2); // +2 for [[
      const endPos = new vscode.Position(position.line, endCol - 2); // -2 for ]]

      return {
        title: linkTitle,
        sourceFile: document.uri.fsPath,
        targetFile: null,
        range: new vscode.Range(startPos, endPos),
        format: 'wikilink',
        targetExists: false,
        displayText
      };
    }
  }

  // Check for [markdown](link) format
  const markdownPattern = /\[([^\]]+)\]\(([^)]+)\)/g;

  while ((match = markdownPattern.exec(text)) !== null) {
    const startCol = match.index;
    const endCol = match.index + match[0].length;

    if (col >= startCol && col <= endCol) {
      const displayText = match[1].trim();
      const linkTarget = match[2].trim();

      // Skip anchor-only links (e.g., (#), (#section))
      if (linkTarget.startsWith('#')) {
        continue;
      }

      // Skip external URLs (http://, https://, etc.)
      if (/^https?:\/\//i.test(linkTarget) || /^mailto:/i.test(linkTarget)) {
        continue;
      }

      const startPos = new vscode.Position(position.line, startCol);
      const endPos = new vscode.Position(position.line, endCol);

      return {
        title: linkTarget,
        sourceFile: document.uri.fsPath,
        targetFile: null,
        range: new vscode.Range(startPos, endPos),
        format: 'markdown',
        targetExists: false,
        displayText
      };
    }
  }

  return null;
}

/**
 * Register the link navigation command
 * Command: lkap.goToLink
 * Functionality:
 * - Get link under cursor position
 * - Resolve link target using LinkResolver
 * - Open target file if found
 * - If target missing: show candidates or offer to create note
 *
 * @param context VSCode extension context
 * @param linkResolver The LinkResolver service instance
 */
export function registerLinkNavigationCommand(
  context: vscode.ExtensionContext,
  linkResolver: LinkResolver
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('lkap.goToLink', async () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showInformationMessage('No active editor');
          return;
        }

        const document = editor.document;
        const position = editor.selection.active;

        // Find link at cursor position
        const link = findLinkAtPosition(document, position);
        if (!link) {
          vscode.window.showInformationMessage('No link found at cursor position');
          return;
        }

        // Resolve link target
        const resolution = linkResolver.resolveLink(link, document.uri.fsPath);

        if (resolution.exists && resolution.targetFile) {
          // Target exists - open it
          const targetUri = vscode.Uri.file(resolution.targetFile);
          const doc = await vscode.workspace.openTextDocument(targetUri);
          await vscode.window.showTextDocument(doc);
        } else {
          // Target doesn't exist - offer options
          const candidates = resolution.candidates || [];

          if (candidates.length > 0) {
            // Show candidates to choose from
            const items = candidates.map((candidate) => ({
              label: candidate.name,
              description: candidate.path,
              target: candidate.path
            }));

            items.push({
              label: '$(add) Create new note',
              description: `Create: ${link.displayText}.md`,
              target: null
            });

            const selection = await vscode.window.showQuickPick(items, {
              placeHolder: 'Link target not found. Choose an option:'
            });

            if (selection) {
              if (selection.target) {
                // Open candidate
                const doc = await vscode.workspace.openTextDocument(
                  vscode.Uri.file(selection.target)
                );
                await vscode.window.showTextDocument(doc);
              } else {
                // Create new note
                await vscode.commands.executeCommand('lkap.createFromLink', link);
              }
            }
          } else {
            // No candidates - offer to create
            const option = await vscode.window.showQuickPick(
              [
                {
                  label: '$(add) Create note',
                  description: `Create new note: ${link.displayText}.md`
                },
                {
                  label: '$(close) Cancel',
                  description: 'Do nothing'
                }
              ],
              {
                placeHolder: `Link target not found: ${link.displayText}`
              }
            );

            if (option?.label.includes('Create')) {
              await vscode.commands.executeCommand('lkap.createFromLink', link);
            }
          }
        }
      } catch (error) {
        console.error('Error in link navigation:', error);
        vscode.window.showErrorMessage(
          `Failed to navigate link: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );
}
