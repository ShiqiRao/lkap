import * as vscode from 'vscode';
import { registerDailyNoteCommands } from './commands/dailyNote';

/**
 * 扩展激活函数
 * 当扩展被激活时调用
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Link Knowledge And Plan extension is now active!');

    try {
        // 注册日记相关命令
        registerDailyNoteCommands(context);

        // 设置扩展状态
        vscode.commands.executeCommand('setContext', 'lkap.enabled', true);

        // 显示激活消息
        vscode.window.showInformationMessage('Link Knowledge And Plan 已激活！');

        console.log('All commands registered successfully');
    } catch (error) {
        console.error('Failed to activate extension:', error);
        vscode.window.showErrorMessage('Link Knowledge And Plan 激活失败: ' + error);
    }
}

/**
 * 扩展停用函数
 * 当扩展被停用时调用
 */
export function deactivate() {
    console.log('Link Knowledge And Plan extension is now deactivated');
    
    // 清理扩展状态
    vscode.commands.executeCommand('setContext', 'lkap.enabled', false);
} 