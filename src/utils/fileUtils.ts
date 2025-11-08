import * as vscode from 'vscode';
import * as path from 'path';

/**
 * 文件操作工具类
 */
export class FileUtils {
  /**
   * 获取工作区根路径
   */
  static getWorkspaceRoot(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.uri.fsPath;
  }

  /**
   * 解析相对路径为绝对路径
   */
  static resolveWorkspacePath(relativePath: string): string {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error('No workspace folder found');
    }
    return path.resolve(workspaceRoot, relativePath);
  }

  /**
   * 检查文件是否存在
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 创建目录（如果不存在）
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));
    } catch (error: any) {
      // 如果目录已存在，忽略错误
      if (error.code !== 'FileExists') {
        throw error;
      }
    }
  }

  /**
   * 创建文件并写入内容
   */
  static async createFile(filePath: string, content: string): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
  }

  /**
   * 读取文件内容
   */
  static async readFile(filePath: string): Promise<string> {
    const uri = vscode.Uri.file(filePath);
    const content = await vscode.workspace.fs.readFile(uri);
    return new TextDecoder().decode(content);
  }

  /**
   * 获取文件的相对路径（相对于工作区）
   */
  static getRelativePath(absolutePath: string): string {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return absolutePath;
    }
    return path.relative(workspaceRoot, absolutePath);
  }

  /**
   * 从文件路径提取文件名（不含扩展名）
   */
  static getFileNameWithoutExt(filePath: string): string {
    const basename = path.basename(filePath);
    return path.parse(basename).name;
  }

  /**
   * 获取所有 Markdown 文件
   */
  static async getMarkdownFiles(searchPath?: string): Promise<vscode.Uri[]> {
    let pattern: string;

    if (searchPath) {
      // Convert absolute path to relative glob pattern
      if (path.isAbsolute(searchPath)) {
        const relativePath = this.getRelativePath(searchPath);
        // Use empty string if relative path is empty (searching from root)
        pattern = relativePath ? `${relativePath}/**/*.md` : '**/*.md';
      } else {
        pattern = `${searchPath}/**/*.md`;
      }
    } else {
      pattern = '**/*.md';
    }

    const excludePattern = '**/node_modules/**';

    return await vscode.workspace.findFiles(
      pattern,
      excludePattern
    );
  }

  /**
   * 安全地打开文件（如果文件不存在则创建）
   */
  static async openOrCreateFile(filePath: string, defaultContent: string = ''): Promise<vscode.TextEditor> {
    const uri = vscode.Uri.file(filePath);
    
    // 检查文件是否存在
    const exists = await this.fileExists(filePath);
    
    if (!exists) {
      // 确保目录存在
      const dir = path.dirname(filePath);
      await this.ensureDirectory(dir);
      
      // 创建文件
      await this.createFile(filePath, defaultContent);
    }
    
    // 打开文件
    return await vscode.window.showTextDocument(uri);
  }
} 