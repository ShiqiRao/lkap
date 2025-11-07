import * as vscode from 'vscode';

/**
 * 扩展配置接口
 */
export interface ExtensionConfig {
  notesPath: string;
  dailyNoteFormat: string;
  dailyNoteTemplate: string;
  autoCreateLinks: boolean;
  enableIndexing: boolean;
}

/**
 * 解析后的链接信息
 */
export interface ParsedLink {
  title: string;
  range: vscode.Range;
  targetFile: string | null;
  sourceFile: string;
}

/**
 * 链接引用信息（用于元数据解析）
 */
export interface LinkReference {
  name: string;
  path: string;
  title?: string;
  sourceFile: string;  // 来源文件路径
  priority?: number;   // 优先级，用于冲突解决 (越高越优先)
}

/**
 * 全局链接引用管理器
 * 处理同名引用的冲突解决
 */
export interface GlobalLinkReferences {
  /**
   * 获取指定名称的最佳匹配引用
   * @param name 引用名称
   * @param contextFile 当前文档路径，用于上下文相关的解析
   * @returns 最佳匹配的链接引用，如果没找到则返回null
   */
  getBestMatch(name: string, contextFile?: string): LinkReference | null;

  /**
   * 添加链接引用
   * @param reference 要添加的引用
   */
  addReference(reference: LinkReference): void;

  /**
   * 移除来自特定文件的所有引用
   * @param sourceFile 源文件路径
   */
  removeReferencesFromFile(sourceFile: string): void;

  /**
   * 获取所有引用的副本
   */
  getAllReferences(): Map<string, LinkReference[]>;
}

/**
 * 解析后的标签信息
 */
export interface ParsedTag {
  name: string;
  range: vscode.Range;
  file: string;
}

/**
 * 文件元数据
 */
export interface FileMetadata {
  path: string;
  title: string;
  lastModified: number;
  size: number;
  linkCount: number;
  tagCount: number;
}

/**
 * 索引状态
 */
export interface IndexStatus {
  isBuilding: boolean;
  lastBuildTime: Date | null;
  totalFiles: number;
  indexedFiles: number;
}

/**
 * 日记模板变量
 */
export interface DailyNoteTemplateVars {
  date: string;
  dayOfWeek: string;
  timestamp: string;
  [key: string]: string;
}

/**
 * 命令执行结果
 */
export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
} 