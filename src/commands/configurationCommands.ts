import * as vscode from 'vscode';
import { BacklinksProvider, LinkValidationReport } from '../services/backlinksProvider';
import { LinkIndexService } from '../services/linkIndexService';

/**
 * Register configuration and utility commands
 * - lkap.validateLinks: Check for broken links
 * - lkap.rebuildIndex: Force rebuild index
 *
 * @param context VSCode extension context
 * @param backlinksProvider The BacklinksProvider service instance
 * @param linkIndexService The LinkIndexService instance
 */
export function registerConfigurationCommands(
  context: vscode.ExtensionContext,
  backlinksProvider: BacklinksProvider,
  linkIndexService: LinkIndexService
): void {
  /**
   * Command: lkap.validateLinks
   * Validates all links in the index and shows a report
   */
  context.subscriptions.push(
    vscode.commands.registerCommand('lkap.validateLinks', async () => {
      try {
        // Show progress
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Validating links...',
            cancellable: false
          },
          async (progress) => {
            const report = backlinksProvider.validateLinks();

            // Show results in notification
            const message =
              `Link validation complete: ${report.valid} valid, ${report.broken} broken`;

            if (report.broken === 0) {
              vscode.window.showInformationMessage(message);
            } else {
              // Show error message with details option
              const result = await vscode.window.showWarningMessage(
                message,
                'Show Details'
              );

              if (result === 'Show Details') {
                // Show broken links in output channel
                const outputChannel = vscode.window.createOutputChannel('LKAP Link Validation');
                outputChannel.clear();
                outputChannel.appendLine('BROKEN LINKS REPORT');
                outputChannel.appendLine('===================\n');

                for (const detail of report.details) {
                  outputChannel.appendLine(`Source: ${detail.source}`);
                  outputChannel.appendLine(`  Missing: ${detail.target}`);
                  outputChannel.appendLine(`  Line ${detail.link.range.start.line + 1}`);
                  outputChannel.appendLine('');
                }

                outputChannel.show();
              }
            }
          }
        );
      } catch (error) {
        console.error('Error validating links:', error);
        vscode.window.showErrorMessage(
          `Failed to validate links: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  /**
   * Command: lkap.rebuildIndex
   * Force rebuild the entire index with progress notification
   */
  context.subscriptions.push(
    vscode.commands.registerCommand('lkap.rebuildIndex', async () => {
      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Rebuilding link index...',
            cancellable: false
          },
          async (progress) => {
            const startTime = Date.now();

            try {
              await linkIndexService.rebuildIndex(false); // false = don't show another progress

              const duration = ((Date.now() - startTime) / 1000).toFixed(2);
              const stats = linkIndexService.getStats();

              vscode.window.showInformationMessage(
                `Index rebuilt successfully in ${duration}s. ${stats.totalFiles} files, ${stats.totalLinks} links.`
              );
            } catch (error) {
              throw error;
            }
          }
        );
      } catch (error) {
        console.error('Error rebuilding index:', error);
        vscode.window.showErrorMessage(
          `Failed to rebuild index: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );

  /**
   * Command: lkap.showLinkStats
   * Show statistics about the current index
   */
  context.subscriptions.push(
    vscode.commands.registerCommand('lkap.showLinkStats', async () => {
      try {
        const stats = linkIndexService.getStats();
        const report = backlinksProvider.validateLinks();

        const message = `
        Link Index Statistics:

        Files: ${stats.totalFiles}
        Links: ${stats.totalLinks}

        Link Validation:
        - Valid: ${report.valid}
        - Broken: ${report.broken}
        `;

        vscode.window.showInformationMessage(message.trim());
      } catch (error) {
        console.error('Error showing link stats:', error);
        vscode.window.showErrorMessage(
          `Failed to show link stats: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );
}
