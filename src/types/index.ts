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

/**
 * A single link instance in a file
 * Represents either [[wiki-style]] or [markdown](note) link format
 */
export interface LinkInstance {
  /** The text displayed or the target of the link */
  title: string;

  /** The file this link appears in (absolute path) */
  sourceFile: string;

  /** The target file this link points to (absolute path or null if not found) */
  targetFile: string | null;

  /** Start position in the document */
  range: vscode.Range;

  /** Link format type */
  format: 'wikilink' | 'markdown';

  /** Whether the target file exists */
  targetExists: boolean;

  /** Human-readable link text (for display) */
  displayText: string;
}

/**
 * Index entry for a single file
 * Contains all links and metadata about the file
 */
export interface FileIndex {
  /** Absolute path to the file */
  path: string;

  /** File name without extension */
  name: string;

  /** Last time this file was indexed (timestamp) */
  lastIndexed: number;

  /** Hash of file content for change detection */
  contentHash: string;

  /** All outgoing links from this file */
  outgoingLinks: LinkInstance[];

  /** File metadata */
  metadata: {
    title?: string;
    createdAt?: number;
    modifiedAt?: number;
    size: number;
  };
}

/**
 * Complete index of all files and links in the workspace
 */
export interface LinkIndex {
  /** Map of file path -> FileIndex */
  files: Map<string, FileIndex>;

  /** Reverse map: target file -> list of source files that link to it */
  backlinks: Map<string, Set<string>>;

  /** All unique tags found in notes */
  tags: Map<string, Set<string>>;

  /** Global index metadata */
  metadata: {
    version: '1.0';
    lastBuildTime: number;
    totalFiles: number;
    totalLinks: number;
  };
}

/**
 * Link parsing result
 */
export interface LinkParseResult {
  /** Links found in the file */
  links: LinkInstance[];

  /** Tags found in the file */
  tags: string[];

  /** Any parsing errors encountered */
  errors: string[];
}

/**
 * Configuration for link parsing and behavior
 */
export interface LinkConfig {
  /** Enable wiki-style [[note]] links */
  enableWikilinks: boolean;

  /** Enable markdown [text](note) links */
  enableMarkdownLinks: boolean;

  /** Automatically create linked notes if they don't exist */
  autoCreateMissingLinks: boolean;

  /** File extensions to recognize as notes */
  noteExtensions: string[];

  /** Exclude patterns for files to index */
  excludePatterns: string[];
}

/**
 * Query result for backlinks
 */
export interface BacklinksQuery {
  /** File being queried */
  file: string;

  /** Files that link to this file */
  backlinks: FileIndex[];

  /** Total count */
  count: number;
}

/**
 * Link resolution result
 */
export interface LinkResolution {
  /** The link that was resolved */
  link: LinkInstance;

  /** Resolved target file (absolute path or null) */
  targetFile: string | null;

  /** Whether the target exists */
  exists: boolean;

  /** Possible candidates if exact match not found */
  candidates?: FileIndex[];
} 