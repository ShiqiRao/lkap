import * as vscode from 'vscode';
import { registerDailyNoteCommands } from './commands/dailyNote';

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

        // 设置扩展状态
        vscode.commands.executeCommand('setContext', 'lkap.enabled', true);

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