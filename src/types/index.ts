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