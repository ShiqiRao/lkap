import * as vscode from 'vscode';
import * as path from 'path';
import { FileUtils } from '../utils/fileUtils';
import { DateUtils } from '../utils/dateUtils';
import { ExtensionConfig, CommandResult, DailyNoteTemplateVars } from '../types';

/**
 * 日记管理类
 */
export class DailyNoteManager {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * 获取扩展配置
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
   * 创建今天的日记
   */
  async createTodayNote(): Promise<CommandResult> {
    try {
      const config = this.getConfig();
      const today = DateUtils.getTodayString(config.dailyNoteFormat);
      return await this.createDailyNote(today);
    } catch (error) {
      const message = `创建今日日记失败: ${error instanceof Error ? error.message : String(error)}`;
      vscode.window.showErrorMessage(message);
      return { success: false, message };
    }
  }

  /**
   * 创建指定日期的日记
   */
  async createDailyNote(dateString: string): Promise<CommandResult> {
    try {
      const config = this.getConfig();
      
      // 验证日期格式
      if (!DateUtils.isValidDate(dateString, config.dailyNoteFormat)) {
        const message = `无效的日期格式: ${dateString}`;
        vscode.window.showWarningMessage(message);
        return { success: false, message };
      }

      // 生成文件路径
      const fileName = `${dateString}.md`;
      const notesPath = FileUtils.resolveWorkspacePath(config.notesPath);
      const filePath = path.join(notesPath, fileName);

      // 检查文件是否已存在
      const fileExists = await FileUtils.fileExists(filePath);
      
      if (fileExists) {
        // 文件已存在，直接打开
        await vscode.window.showTextDocument(vscode.Uri.file(filePath));
        const message = `打开已存在的日记: ${dateString}`;
        vscode.window.showInformationMessage(message);
        return { success: true, message, data: { filePath, existed: true } };
      } else {
        // 文件不存在，创建新文件
        const content = await this.generateDailyNoteContent(dateString);
        const editor = await FileUtils.openOrCreateFile(filePath, content);
        
        // 将光标定位到内容末尾
        const lastLine = editor.document.lineCount - 1;
        const lastCharacter = editor.document.lineAt(lastLine).text.length;
        const position = new vscode.Position(lastLine, lastCharacter);
        editor.selection = new vscode.Selection(position, position);
        
        const message = `创建新日记: ${dateString}`;
        vscode.window.showInformationMessage(message);
        return { success: true, message, data: { filePath, existed: false } };
      }
    } catch (error) {
      const message = `创建日记失败: ${error instanceof Error ? error.message : String(error)}`;
      vscode.window.showErrorMessage(message);
      return { success: false, message };
    }
  }

  /**
   * 生成日记内容
   */
  private async generateDailyNoteContent(dateString: string): Promise<string> {
    const config = this.getConfig();
    
    // 如果配置了模板文件，使用模板
    if (config.dailyNoteTemplate) {
      try {
        const templatePath = FileUtils.resolveWorkspacePath(config.dailyNoteTemplate);
        const templateExists = await FileUtils.fileExists(templatePath);
        
        if (templateExists) {
          const templateContent = await FileUtils.readFile(templatePath);
          return this.processTemplate(templateContent, dateString);
        }
      } catch (error) {
        console.warn('Failed to load daily note template:', error);
      }
    }

    // 使用默认模板
    return this.getDefaultTemplate(dateString);
  }

  /**
   * 处理模板变量替换
   */
  private processTemplate(template: string, dateString: string): string {
    const date = DateUtils.parseDate(dateString, this.getConfig().dailyNoteFormat) || new Date();
    const vars = DateUtils.getDailyNoteTemplateVars(date);

    let content = template;
    
    // 替换所有模板变量
    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      content = content.replace(regex, value);
    }

    return content;
  }

  /**
   * 获取默认模板
   */
  private getDefaultTemplate(dateString: string): string {
    const date = DateUtils.parseDate(dateString, this.getConfig().dailyNoteFormat) || new Date();
    const vars = DateUtils.getDailyNoteTemplateVars(date);
    const relativeDateDesc = DateUtils.getRelativeDateDescription(date);

    return `# ${dateString}

## 📝 Todo


## 📚 Note


## 💭 Thinking


## 🔗 Link


---
`;
  }

  /**
   * 打开昨天的日记
   */
  async openYesterdayNote(): Promise<CommandResult> {
    const config = this.getConfig();
    const yesterday = DateUtils.getYesterdayString(config.dailyNoteFormat);
    return await this.openDailyNote(yesterday);
  }

  /**
   * 打开明天的日记
   */
  async openTomorrowNote(): Promise<CommandResult> {
    const config = this.getConfig();
    const tomorrow = DateUtils.getTomorrowString(config.dailyNoteFormat);
    return await this.createDailyNote(tomorrow);
  }

  /**
   * 打开指定日期的日记
   */
  async openDailyNote(dateString: string): Promise<CommandResult> {
    try {
      const config = this.getConfig();
      const fileName = `${dateString}.md`;
      const notesPath = FileUtils.resolveWorkspacePath(config.notesPath);
      const filePath = path.join(notesPath, fileName);

      const fileExists = await FileUtils.fileExists(filePath);
      
      if (fileExists) {
        await vscode.window.showTextDocument(vscode.Uri.file(filePath));
        return { success: true, message: `打开日记: ${dateString}` };
      } else {
        // 日记不存在，询问是否创建
        const choice = await vscode.window.showInformationMessage(
          `日记 ${dateString} 不存在，是否创建？`,
          '创建',
          '取消'
        );
        
        if (choice === '创建') {
          return await this.createDailyNote(dateString);
        } else {
          return { success: false, message: '用户取消操作' };
        }
      }
    } catch (error) {
      const message = `打开日记失败: ${error instanceof Error ? error.message : String(error)}`;
      vscode.window.showErrorMessage(message);
      return { success: false, message };
    }
  }

  /**
   * 获取所有日记文件
   */
  async getAllDailyNotes(): Promise<string[]> {
    try {
      const config = this.getConfig();
      const notesPath = FileUtils.resolveWorkspacePath(config.notesPath);
      const files = await FileUtils.getMarkdownFiles(notesPath);
      
      const dailyNotes: string[] = [];
      
      for (const file of files) {
        const fileName = FileUtils.getFileNameWithoutExt(file.fsPath);
        const date = DateUtils.extractDateFromFileName(fileName, config.dailyNoteFormat);
        
        if (date) {
          dailyNotes.push(fileName);
        }
      }
      
      // 按日期排序
      return dailyNotes.sort();
    } catch (error) {
      console.error('Failed to get daily notes:', error);
      return [];
    }
  }
}

/**
 * 注册日记相关命令
 */
export function registerDailyNoteCommands(context: vscode.ExtensionContext) {
  const dailyNoteManager = new DailyNoteManager(context);

  // 创建今日日记命令
  const createTodayNoteCommand = vscode.commands.registerCommand(
    'lkap.createDailyNote',
    () => dailyNoteManager.createTodayNote()
  );

  // 注册命令
  context.subscriptions.push(createTodayNoteCommand);
} 