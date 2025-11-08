import * as vscode from 'vscode';
import { registerDailyNoteCommands } from './commands/dailyNote';
import { LinkIndexService } from './services/linkIndexService';
import { LinkResolver } from './services/linkResolver';
import { BacklinksProvider } from './services/backlinksProvider';
import { registerLinkNavigationCommand } from './commands/linkNavigation';
import { registerQuickLinkCreateCommand } from './commands/quickLinkCreate';
import { registerBacklinksViewProvider } from './views/backlinksView';
import { registerTagsViewProvider } from './views/tagsView';
import { registerLinkHoverProvider } from './providers/linkHoverProvider';

/**
 * 扩展激活函数
 * 当扩展被激活时调用
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('Link Knowledge And Plan extension is activating...');

    try {
        // 1. Register daily note commands (existing functionality)
        registerDailyNoteCommands(context);
        console.log('Daily note commands registered successfully');

        // 2. Set extension state
        vscode.commands.executeCommand('setContext', 'lkap.enabled', true);

        // 3. Verify commands are registered
        vscode.commands.getCommands(true).then(commands => {
            const lkapCommands = commands.filter(cmd => cmd.startsWith('lkap.'));
            console.log('LKAP commands available:', lkapCommands);
        });

        // 4. Initialize LinkIndexService for bidirectional linking
        console.log('Initializing link index service...');
        const linkIndexService = new LinkIndexService(context);
        context.subscriptions.push(linkIndexService);

        // 5. Build initial index on activation
        try {
            console.log('Building initial link index...');
            await linkIndexService.rebuildIndex(true); // true = show progress
            const stats = linkIndexService.getStats();
            console.log('Link index built successfully:', stats);
        } catch (error) {
            console.error('Failed to build link index:', error);
            vscode.window.showErrorMessage(
                `Failed to build link index: ${error instanceof Error ? error.message : String(error)}`
            );
        }

        // 6. Initialize LinkResolver with the index
        console.log('Initializing link resolver...');
        const linkResolver = new LinkResolver(linkIndexService.getIndex());

        // 7. Initialize BacklinksProvider with the index
        console.log('Initializing backlinks provider...');
        const backlinksProvider = new BacklinksProvider(linkIndexService.getIndex());

        // 8. Subscribe to index changes and update resolvers/providers
        linkIndexService.onIndexChanged((newIndex) => {
            console.log('Link index changed, updating resolvers and providers');
            linkResolver.updateIndex(newIndex);
            backlinksProvider.updateIndex(newIndex);
            const stats = linkIndexService.getStats();
            console.log('Link index updated:', stats);
        });

        // 9. Subscribe to configuration changes and rebuild index
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(async (event) => {
                if (event.affectsConfiguration('lkap')) {
                    console.log('LKAP configuration changed, rebuilding index...');
                    try {
                        await linkIndexService.rebuildIndex();
                        const stats = linkIndexService.getStats();
                        console.log('Index rebuilt after config change:', stats);
                    } catch (error) {
                        console.error('Failed to rebuild index after config change:', error);
                    }
                }
            })
        );

        // 10. Register Phase 2 features: Link Navigation & UI
        console.log('Registering Phase 2 features...');

        // Register link navigation command (lkap.goToLink)
        registerLinkNavigationCommand(context, linkResolver);
        console.log('Link navigation command registered');

        // Register quick link creation command (lkap.createFromLink)
        registerQuickLinkCreateCommand(context, linkIndexService);
        console.log('Quick link creation command registered');

        // Register backlinks view provider
        registerBacklinksViewProvider(context, backlinksProvider, linkIndexService);
        console.log('Backlinks view provider registered');

        // Register tags view provider
        registerTagsViewProvider(context, linkIndexService);
        console.log('Tags view provider registered');

        // Register link hover provider
        registerLinkHoverProvider(context, linkResolver, linkIndexService);
        console.log('Link hover provider registered');

        // Register configuration commands
        // Command: Validate all links
        context.subscriptions.push(
            vscode.commands.registerCommand('lkap.validateLinks', async () => {
                try {
                    const validation = backlinksProvider.validateLinks();
                    const channel = vscode.window.createOutputChannel('LKAP Link Validation');

                    channel.clear();
                    channel.appendLine('=== Link Validation Report ===\n');
                    channel.appendLine(`Total links: ${validation.valid + validation.broken}`);
                    channel.appendLine(`Valid links: ${validation.valid}`);
                    channel.appendLine(`Broken links: ${validation.broken}\n`);

                    if (validation.broken > 0) {
                        channel.appendLine('Broken links:');
                        for (const detail of validation.details) {
                            channel.appendLine(`  ${detail.source} -> ${detail.target}`);
                        }
                    } else {
                        channel.appendLine('All links are valid! ✓');
                    }

                    channel.show();

                    if (validation.broken > 0) {
                        vscode.window.showWarningMessage(
                            `Found ${validation.broken} broken link(s). Check output for details.`
                        );
                    } else {
                        vscode.window.showInformationMessage('All links are valid!');
                    }
                } catch (error) {
                    console.error('Failed to validate links:', error);
                    vscode.window.showErrorMessage(
                        `Failed to validate links: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            })
        );

        // Command: Rebuild index manually
        context.subscriptions.push(
            vscode.commands.registerCommand('lkap.rebuildIndex', async () => {
                try {
                    await linkIndexService.rebuildIndex(true); // true = show progress
                    const stats = linkIndexService.getStats();
                    vscode.window.showInformationMessage(
                        `Index rebuilt: ${stats.totalFiles} files, ${stats.totalLinks} links, ${stats.totalTags} tags`
                    );
                } catch (error) {
                    console.error('Failed to rebuild index:', error);
                    vscode.window.showErrorMessage(
                        `Failed to rebuild index: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            })
        );

        console.log('Configuration commands registered');

        console.log('Link Knowledge And Plan extension activated successfully with Phase 2 features!');

    } catch (error) {
        console.error('Failed to activate Link Knowledge And Plan extension:', error);
        vscode.window.showErrorMessage(`Link Knowledge And Plan 激活失败: ${error}`);
        throw error; // Re-throw error to let VSCode know activation failed
    }
}

/**
 * 扩展停用函数
 * 当扩展被停用时调用
 */
export function deactivate() {
    console.log('Link Knowledge And Plan extension is deactivating...');
    
    // 清理扩展状态
    vscode.commands.executeCommand('setContext', 'lkap.enabled', false);
    
    console.log('Link Knowledge And Plan extension deactivated');
} 