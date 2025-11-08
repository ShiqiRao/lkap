import * as vscode from 'vscode';
import { registerDailyNoteCommands } from './commands/dailyNote';
import { LinkIndexService } from './services/linkIndexService';
import { LinkResolver } from './services/linkResolver';
import { BacklinksProvider } from './services/backlinksProvider';

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

        // 10. Store service references in context for Phase 2 features
        // These will be accessible to commands that need to interact with the index
        context.subscriptions.push({
            linkIndexService,
            linkResolver,
            backlinksProvider
        } as any);

        console.log('Link Knowledge And Plan extension activated successfully with bidirectional linking!');

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