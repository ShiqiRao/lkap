import * as vscode from 'vscode';
import { registerDailyNoteCommands } from './commands/dailyNote';
import { registerLinkNavigation } from './commands/linkNavigation';
import { BacklinksViewProvider } from './views/backlinksView';
import { setupFileWatcher } from './utils/fileWatcher';
import { LinkIndexManager } from './utils/linkIndexManager';

/**
 * 扩展激活函数
 * 当扩展被激活时调用
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Link Knowledge And Plan extension is activating...');

    try {
        // 注册日记相关命令
        registerDailyNoteCommands(context);
        console.log('Daily note commands registered successfully');

        // 初始化链接管理器
        const linkManager = LinkIndexManager.getInstance();

        // 注册双向链接相关功能
        registerLinkNavigation(context);
        console.log('Link navigation registered successfully');

        // 注册反向链接视图
        const backlinksView = BacklinksViewProvider.register(context);
        context.subscriptions.push(backlinksView);
        console.log('Backlinks view registered successfully');

        // 注册重建索引命令
        const rebuildIndexCmd = vscode.commands.registerCommand('lkap.rebuildLinkIndex', async () => {
            vscode.window.showInformationMessage('Rebuilding link index...');
            try {
                await linkManager.buildIndex();
                vscode.window.showInformationMessage('Link index rebuilt successfully');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to rebuild link index: ${error}`);
            }
        });
        context.subscriptions.push(rebuildIndexCmd);

        // 设置文件监视器
        const fileWatcher = setupFileWatcher(context);
        context.subscriptions.push({ dispose: () => fileWatcher.dispose() });
        console.log('File watcher set up successfully');

        // 设置扩展状态
        vscode.commands.executeCommand('setContext', 'lkap.enabled', true);

        // 开始构建链接索引
        if (vscode.workspace.getConfiguration('lkap').get<boolean>('enableIndexing', true)) {
            // 在后台构建索引，不阻塞扩展激活
            setTimeout(async () => {
                try {
                    await linkManager.buildIndex();
                    console.log('Link index built successfully');
                } catch (error) {
                    console.error('Error building link index:', error);
                }
            }, 1000);
        }

        // 验证命令是否已注册
        vscode.commands.getCommands(true).then(commands => {
            const lkapCommands = commands.filter(cmd => cmd.startsWith('lkap.'));
            console.log('LKAP commands available:', lkapCommands);
        });

        console.log('Link Knowledge And Plan extension activated successfully!');
        
        // 移除启动时的信息消息，避免打扰用户
        // vscode.window.showInformationMessage('Link Knowledge And Plan 已激活！');

    } catch (error) {
        console.error('Failed to activate Link Knowledge And Plan extension:', error);
        vscode.window.showErrorMessage(`Link Knowledge And Plan 激活失败: ${error}`);
        throw error; // 重新抛出错误，让 VSCode 知道激活失败
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