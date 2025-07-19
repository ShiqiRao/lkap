# Link Knowledge And Plan - 开发文档

## 📋 项目概述

### 项目目标
创建一个高效的 VSCode 扩展，为用户提供完整的 markdown 笔记管理解决方案，支持日记创建、双向链接和标签管理。

### 核心价值
- **提升效率**: 快速创建和管理日常笔记
- **知识连接**: 通过双向链接构建知识网络
- **便捷分类**: 通过标签系统组织笔记内容

## 🏗️ 技术架构

### 技术栈
- **开发语言**: TypeScript
- **运行环境**: Node.js
- **框架**: VSCode Extension API
- **构建工具**: esbuild / webpack
- **测试框架**: Jest + VSCode Test Runner
- **代码规范**: ESLint + Prettier

### 项目结构
```
lkap/
├── src/                          # 源代码目录
│   ├── extension.ts              # 扩展入口文件
│   ├── commands/                 # 命令处理
│   │   ├── dailyNote.ts         # 日记相关命令
│   │   ├── bidirectionalLink.ts # 双向链接命令
│   │   └── tagManager.ts        # 标签管理命令
│   ├── providers/               # 内容提供者
│   │   ├── linkProvider.ts      # 链接完成提供者
│   │   ├── tagProvider.ts       # 标签提供者
│   │   └── hoverProvider.ts     # 悬停预览提供者
│   ├── views/                   # 视图组件
│   │   ├── tagTreeView.ts       # 标签树视图
│   │   ├── backlinksView.ts     # 反向链接视图
│   │   └── graphView.ts         # 关系图视图
│   ├── index/                   # 索引管理
│   │   ├── indexManager.ts      # 主索引管理器
│   │   ├── linkIndexer.ts       # 链接索引器
│   │   ├── tagIndexer.ts        # 标签索引器
│   │   ├── fileWatcher.ts       # 文件监控器
│   │   └── cacheManager.ts      # 缓存管理器
│   ├── utils/                   # 工具函数
│   │   ├── fileUtils.ts         # 文件操作工具
│   │   ├── dateUtils.ts         # 日期处理工具
│   │   ├── linkUtils.ts         # 链接解析工具
│   │   ├── tagUtils.ts          # 标签解析工具
│   │   ├── indexUtils.ts        # 索引相关工具
│   │   └── performanceUtils.ts  # 性能监控工具
│   ├── types/                   # 类型定义
│   │   └── index.ts            # 公共类型
│   └── test/                    # 测试文件
│       ├── suite/               # 测试套件
│       └── runTest.ts           # 测试运行器
├── resources/                   # 资源文件
│   ├── icons/                   # 图标文件
│   └── templates/               # 模板文件
├── package.json                 # 包配置文件
├── tsconfig.json               # TypeScript 配置
├── webpack.config.js           # 构建配置
├── .eslintrc.json             # 代码规范配置
├── .gitignore                 # Git 忽略文件
└── CHANGELOG.md               # 更新日志
```

## 🚀 核心功能实现

### 1. 快速创建日记功能

#### 技术方案
- 使用 VSCode Command API 注册快捷键命令
- 通过 moment.js 或 dayjs 处理日期格式
- 利用 VSCode Workspace API 管理文件路径

#### 实现步骤
```typescript
// 日记创建命令
export async function createDailyNote(): Promise<void> {
  const config = vscode.workspace.getConfiguration('lkap');
  const notesPath = config.get<string>('notesPath', './notes');
  const dateFormat = config.get<string>('dailyNoteFormat', 'YYYY-MM-DD');
  
  const today = moment().format(dateFormat);
  const fileName = `${today}.md`;
  const filePath = path.join(notesPath, fileName);
  
  try {
    // 检查文件是否存在
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    // 文件存在，直接打开
    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
  } catch {
    // 文件不存在，创建新文件
    const template = await getTemplate('daily');
    await createFileWithTemplate(filePath, template, { date: today });
    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
  }
}
```

#### 配置选项
- `notesPath`: 笔记存储路径
- `dailyNoteFormat`: 日期格式字符串
- `dailyNoteTemplate`: 日记模板路径

### 2. 双向链接功能

#### 技术方案
- 使用正则表达式解析 `[[title]]` 语法
- 实现 CompletionItemProvider 提供自动完成
- 创建 DocumentLinkProvider 提供链接跳转
- 使用 HoverProvider 提供链接预览

#### 核心算法
```typescript
// 链接解析器
export class LinkParser {
  private static readonly LINK_REGEX = /\[\[([^\]]+)\]\]/g;
  
  static parseLinkDocument(document: vscode.TextDocument): ParsedLink[] {
    const text = document.getText();
    const links: ParsedLink[] = [];
    let match;
    
    while ((match = this.LINK_REGEX.exec(text)) !== null) {
      const title = match[1];
      const range = new vscode.Range(
        document.positionAt(match.index),
        document.positionAt(match.index + match[0].length)
      );
      
      links.push({
        title,
        range,
        targetFile: this.resolveTargetFile(title),
        sourceFile: document.uri.fsPath
      });
    }
    
    return links;
  }
}
```

#### 反向链接实现
```typescript
// 反向链接管理器
export class BacklinkManager {
  private backlinks: Map<string, Set<string>> = new Map();
  
  async buildBacklinkIndex(): Promise<void> {
    const workspaceFiles = await this.getMarkdownFiles();
    
    for (const file of workspaceFiles) {
      const document = await vscode.workspace.openTextDocument(file);
      const links = LinkParser.parseLinkDocument(document);
      
      for (const link of links) {
        this.addBacklink(link.targetFile, link.sourceFile);
      }
    }
  }
  
  getBacklinks(file: string): string[] {
    return Array.from(this.backlinks.get(file) || []);
  }
}
```

#### 索引系统设计

双向链接功能的核心是建立和维护一个高效的索引系统，该系统负责跟踪所有笔记之间的链接关系。

##### 索引数据结构
```typescript
// 索引管理器
export class IndexManager {
  // 正向链接索引：文件 -> 该文件中包含的所有链接
  private forwardLinks: Map<string, ParsedLink[]> = new Map();
  
  // 反向链接索引：文件 -> 链接到该文件的所有源文件
  private backlinks: Map<string, Set<string>> = new Map();
  
  // 标签索引：标签名 -> 包含该标签的所有文件
  private tagIndex: Map<string, Set<string>> = new Map();
  
  // 文件索引：文件路径 -> 文件元数据
  private fileIndex: Map<string, FileMetadata> = new Map();
  
  // 索引状态跟踪
  private indexStatus: IndexStatus = {
    isBuilding: false,
    lastBuildTime: null,
    totalFiles: 0,
    indexedFiles: 0
  };
}

interface FileMetadata {
  path: string;
  title: string;
  lastModified: number;
  size: number;
  linkCount: number;
  tagCount: number;
}

interface IndexStatus {
  isBuilding: boolean;
  lastBuildTime: Date | null;
  totalFiles: number;
  indexedFiles: number;
}
```

##### 索引建立流程

索引建立是一个多阶段的过程，需要考虑性能和用户体验：

```typescript
export class IndexManager {
  async buildFullIndex(): Promise<void> {
    this.indexStatus.isBuilding = true;
    
    try {
      // 阶段1: 发现所有文件
      const files = await this.discoverFiles();
      this.indexStatus.totalFiles = files.length;
      
      // 阶段2: 并行解析文件内容
      await this.parseFilesInBatches(files);
      
      // 阶段3: 构建反向索引
      this.buildReverseIndexes();
      
      // 阶段4: 验证索引完整性
      await this.validateIndex();
      
      this.indexStatus.lastBuildTime = new Date();
      this.notifyIndexComplete();
      
    } catch (error) {
      this.handleIndexError(error);
    } finally {
      this.indexStatus.isBuilding = false;
    }
  }
  
  private async discoverFiles(): Promise<vscode.Uri[]> {
    const config = vscode.workspace.getConfiguration('lkap');
    const notesPath = config.get<string>('notesPath', './notes');
    const includePattern = '**/*.md';
    const excludePattern = '**/node_modules/**';
    
    return await vscode.workspace.findFiles(
      new vscode.RelativePattern(notesPath, includePattern),
      excludePattern
    );
  }
  
  private async parseFilesInBatches(files: vscode.Uri[]): Promise<void> {
    const BATCH_SIZE = 10; // 每批处理10个文件，避免阻塞UI
    
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      
      // 并行处理批次内的文件
      await Promise.all(batch.map(file => this.parseFile(file)));
      
      this.indexStatus.indexedFiles = Math.min(i + BATCH_SIZE, files.length);
      this.notifyIndexProgress();
      
      // 让出执行权，避免长时间阻塞
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  private async parseFile(fileUri: vscode.Uri): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      const filePath = fileUri.fsPath;
      
      // 解析链接
      const links = LinkParser.parseLinkDocument(document);
      this.forwardLinks.set(filePath, links);
      
      // 解析标签
      const tags = TagParser.parseTagsFromDocument(document);
      this.updateTagIndex(filePath, tags);
      
      // 更新文件元数据
      const metadata = await this.extractFileMetadata(document);
      this.fileIndex.set(filePath, metadata);
      
    } catch (error) {
      console.error(`Failed to parse file ${fileUri.fsPath}:`, error);
    }
  }
  
  private buildReverseIndexes(): void {
    // 清空现有反向索引
    this.backlinks.clear();
    
    // 遍历所有正向链接，构建反向索引
    for (const [sourceFile, links] of this.forwardLinks) {
      for (const link of links) {
        const targetFile = this.resolveTargetFile(link.title);
        if (targetFile) {
          this.addBacklink(targetFile, sourceFile);
        }
      }
    }
  }
}
```

##### 增量索引更新

为了提高性能，系统应支持增量更新，只重新索引发生变化的文件：

```typescript
export class IndexManager {
  private fileWatcher: vscode.FileSystemWatcher;
  
  initializeFileWatcher(): void {
    const config = vscode.workspace.getConfiguration('lkap');
    const notesPath = config.get<string>('notesPath', './notes');
    
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(notesPath, '**/*.md')
    );
    
    // 文件创建
    this.fileWatcher.onDidCreate(uri => {
      this.handleFileCreated(uri);
    });
    
    // 文件修改
    this.fileWatcher.onDidChange(uri => {
      this.handleFileChanged(uri);
    });
    
    // 文件删除
    this.fileWatcher.onDidDelete(uri => {
      this.handleFileDeleted(uri);
    });
  }
  
  private async handleFileChanged(uri: vscode.Uri): Promise<void> {
    const filePath = uri.fsPath;
    
    // 检查文件是否真的发生了变化
    const currentMetadata = await this.extractFileMetadata(
      await vscode.workspace.openTextDocument(uri)
    );
    const oldMetadata = this.fileIndex.get(filePath);
    
    if (oldMetadata && oldMetadata.lastModified >= currentMetadata.lastModified) {
      return; // 文件没有实际变化
    }
    
    // 移除旧的索引条目
    this.removeFileFromIndex(filePath);
    
    // 重新解析和索引文件
    await this.parseFile(uri);
    
    // 重建受影响的反向链接
    this.rebuildAffectedBacklinks(filePath);
    
    // 通知相关视图更新
    this.notifyIndexUpdated(filePath);
  }
  
  private removeFileFromIndex(filePath: string): void {
    // 移除正向链接
    const oldLinks = this.forwardLinks.get(filePath) || [];
    this.forwardLinks.delete(filePath);
    
    // 移除相关的反向链接
    for (const link of oldLinks) {
      const targetFile = this.resolveTargetFile(link.title);
      if (targetFile) {
        const backlinks = this.backlinks.get(targetFile);
        if (backlinks) {
          backlinks.delete(filePath);
          if (backlinks.size === 0) {
            this.backlinks.delete(targetFile);
          }
        }
      }
    }
    
    // 移除标签索引
    const oldTags = this.getFileTagsFromIndex(filePath);
    for (const tag of oldTags) {
      const tagFiles = this.tagIndex.get(tag);
      if (tagFiles) {
        tagFiles.delete(filePath);
        if (tagFiles.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
    
    // 移除文件元数据
    this.fileIndex.delete(filePath);
  }
  
  private rebuildAffectedBacklinks(changedFile: string): void {
    // 找到所有链接到已更改文件的文件
    const affectedFiles = this.backlinks.get(changedFile) || new Set();
    
    // 重新构建这些文件的反向链接
    for (const affectedFile of affectedFiles) {
      const links = this.forwardLinks.get(affectedFile) || [];
      for (const link of links) {
        const targetFile = this.resolveTargetFile(link.title);
        if (targetFile === changedFile) {
          this.addBacklink(targetFile, affectedFile);
        }
      }
    }
  }
}
```

##### 索引持久化和缓存

为了提高启动性能，可以将索引数据持久化到磁盘：

```typescript
export class IndexManager {
  private readonly INDEX_CACHE_FILE = '.vscode/markdown-note-index.json';
  
  async saveIndexToCache(): Promise<void> {
    const indexData = {
      version: '1.0.0',
      timestamp: Date.now(),
      forwardLinks: Array.from(this.forwardLinks.entries()),
      backlinks: Array.from(this.backlinks.entries()).map(([key, value]) => [
        key,
        Array.from(value)
      ]),
      tagIndex: Array.from(this.tagIndex.entries()).map(([key, value]) => [
        key,
        Array.from(value)
      ]),
      fileIndex: Array.from(this.fileIndex.entries())
    };
    
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        const cacheUri = vscode.Uri.joinPath(workspaceFolder.uri, this.INDEX_CACHE_FILE);
        await vscode.workspace.fs.writeFile(
          cacheUri,
          Buffer.from(JSON.stringify(indexData, null, 2))
        );
      }
    } catch (error) {
      console.error('Failed to save index cache:', error);
    }
  }
  
  async loadIndexFromCache(): Promise<boolean> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return false;
      
      const cacheUri = vscode.Uri.joinPath(workspaceFolder.uri, this.INDEX_CACHE_FILE);
      const cacheData = await vscode.workspace.fs.readFile(cacheUri);
      const indexData = JSON.parse(cacheData.toString());
      
      // 验证缓存版本和新鲜度
      if (!this.isCacheValid(indexData)) {
        return false;
      }
      
      // 恢复索引数据
      this.forwardLinks = new Map(indexData.forwardLinks);
      this.backlinks = new Map(
        indexData.backlinks.map(([key, value]) => [key, new Set(value)])
      );
      this.tagIndex = new Map(
        indexData.tagIndex.map(([key, value]) => [key, new Set(value)])
      );
      this.fileIndex = new Map(indexData.fileIndex);
      
      return true;
    } catch (error) {
      console.error('Failed to load index cache:', error);
      return false;
    }
  }
  
  private isCacheValid(indexData: any): boolean {
    // 检查版本兼容性
    if (indexData.version !== '1.0.0') {
      return false;
    }
    
    // 检查缓存新鲜度（例如：1小时内的缓存有效）
    const cacheAge = Date.now() - indexData.timestamp;
    const maxCacheAge = 60 * 60 * 1000; // 1小时
    
    return cacheAge < maxCacheAge;
  }
}
```

##### 索引性能优化

```typescript
export class IndexManager {
  // 使用 LRU 缓存频繁访问的解析结果
  private parseCache = new Map<string, { 
    content: string, 
    result: ParsedLink[], 
    timestamp: number 
  }>();
  
  // 批量操作优化
  private pendingUpdates = new Set<string>();
  private updateTimer: NodeJS.Timeout | null = null;
  
  private scheduleIndexUpdate(filePath: string): void {
    this.pendingUpdates.add(filePath);
    
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    
    // 批量处理延迟更新，避免频繁的索引重建
    this.updateTimer = setTimeout(() => {
      this.processPendingUpdates();
    }, 500); // 500ms 延迟
  }
  
  private async processPendingUpdates(): Promise<void> {
    const filesToUpdate = Array.from(this.pendingUpdates);
    this.pendingUpdates.clear();
    
    // 并行处理所有待更新的文件
    await Promise.all(
      filesToUpdate.map(filePath => this.updateFileIndex(filePath))
    );
    
    this.notifyIndexUpdated();
  }
  
  // 内存使用监控和清理
  private monitorMemoryUsage(): void {
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
      
      // 如果内存使用超过阈值，清理缓存
      if (heapUsedMB > 100) { // 100MB 阈值
        this.cleanupCaches();
      }
    }, 30000); // 30秒检查一次
  }
  
  private cleanupCaches(): void {
    // 清理解析缓存中的旧条目
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10分钟
    
    for (const [key, value] of this.parseCache) {
      if (now - value.timestamp > maxAge) {
        this.parseCache.delete(key);
      }
    }
  }
}
```

### 3. 标签管理功能

#### 技术方案
- 使用正则表达式解析标签语法
- 实现 TreeDataProvider 创建标签树视图
- 提供标签自动完成和验证
- 支持标签重命名和批量操作

#### 标签解析实现
```typescript
// 标签解析器
export class TagParser {
  private static readonly TAG_REGEX = /#([a-zA-Z0-9_\u4e00-\u9fa5]+)/g;
  
  static parseTagsFromDocument(document: vscode.TextDocument): ParsedTag[] {
    const text = document.getText();
    const tags: ParsedTag[] = [];
    let match;
    
    while ((match = this.TAG_REGEX.exec(text)) !== null) {
      const tagName = match[1];
      const range = new vscode.Range(
        document.positionAt(match.index),
        document.positionAt(match.index + match[0].length)
      );
      
      tags.push({
        name: tagName,
        range,
        file: document.uri.fsPath
      });
    }
    
    return tags;
  }
}
```

## 📦 扩展配置

### package.json 配置
```json
{
  "name": "markdown-note-manager",
  "displayName": "Markdown Note Manager",
  "description": "A powerful VSCode extension for managing markdown notes",
  "version": "1.0.0",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": ["Other"],
  "keywords": ["markdown", "notes", "wiki", "knowledge", "linking"],
  "activationEvents": [
    "onLanguage:markdown"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "lkap.createDailyNote",
        "title": "Create Today's Note",
        "category": "Markdown Note Manager"
      }
    ],
    "keybindings": [
      {
        "command": "lkap.createDailyNote",
        "key": "ctrl+shift+t",
        "mac": "cmd+shift+t",
        "when": "editorTextFocus"
      }
    ],
    "configuration": {
      "title": "Markdown Note Manager",
      "properties": {
        "lkap.notesPath": {
          "type": "string",
          "default": "./notes",
          "description": "Path to store note files"
        },
        "lkap.dailyNoteFormat": {
          "type": "string",
          "default": "YYYY-MM-DD",
          "description": "Date format for daily notes"
        },
        "lkap.autoCreateLinks": {
          "type": "boolean",
          "default": true,
          "description": "Automatically create missing link targets"
        }
      }
    },
    "views": {
      "explorer": [
        {
          "id": "lkap.tagView",
          "name": "Tags",
          "when": "lkap.enabled"
        },
        {
          "id": "lkap.backlinksView",
          "name": "Backlinks",
          "when": "lkap.enabled"
        }
      ]
    }
  }
}
```

## 🧪 测试策略

### 单元测试
- 测试工具函数（文件操作、日期处理、链接解析）
- 测试命令处理逻辑
- 测试配置管理

### 集成测试
- 测试扩展激活和注销
- 测试命令执行流程
- 测试视图更新逻辑

### 端到端测试
- 测试完整的用户工作流
- 测试扩展与 VSCode 的集成
- 测试性能和稳定性

## 📈 开发计划

### Phase 1: 基础功能 (4周)
- [x] 项目搭建和环境配置
- [ ] 快速创建日记功能
- [ ] 基础双向链接支持
- [ ] 简单标签解析
- [ ] 基础索引系统设计
- [ ] 文件发现和解析器实现

### Phase 2: 核心功能完善 (6周)
- [ ] 链接自动完成和跳转
- [ ] 反向链接显示
- [ ] 标签树视图
- [ ] 配置管理界面
- [ ] 完整索引管理器实现
- [ ] 增量索引更新机制
- [ ] 索引持久化和缓存

### Phase 3: 高级功能 (4周)
- [ ] 链接预览和悬停显示
- [ ] 标签批量操作
- [ ] 模板系统
- [ ] 搜索和过滤
- [ ] 索引性能优化
- [ ] 并发处理和内存管理
- [ ] 索引完整性验证

### Phase 4: 优化和发布 (2周)
- [ ] 性能优化
- [ ] 用户体验改进
- [ ] 文档完善
- [ ] 扩展市场发布
- [ ] 索引性能基准测试
- [ ] 大规模笔记库测试

## 🔧 开发工具和脚本

### 开发命令
```json
{
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "pretest": "npm run compile && npm run lint",
    "lint": "eslint src --ext ts",
    "test": "node ./out/test/runTest.js",
    "package": "vsce package",
    "publish": "vsce publish"
  }
}
```

### 依赖管理
```json
{
  "devDependencies": {
    "@types/vscode": "^1.74.0",
    "@types/node": "16.x",
    "@typescript-eslint/eslint-plugin": "^5.45.0",
    "@typescript-eslint/parser": "^5.45.0",
    "eslint": "^8.28.0",
    "typescript": "^4.9.4",
    "@vscode/test-electron": "^2.2.0",
    "vsce": "^2.15.0"
  },
  "dependencies": {
    "moment": "^2.29.4",
    "glob": "^8.0.3"
  }
}
```

## 🚨 风险评估和解决方案

### 技术风险
1. **性能问题**: 大量文件时链接解析可能较慢
   - 解决方案: 使用缓存和增量更新
   
2. **兼容性问题**: 不同操作系统的文件路径处理
   - 解决方案: 使用 VSCode 的路径 API

3. **内存占用**: 大型笔记库可能占用过多内存
   - 解决方案: 实现懒加载和分页

### 用户体验风险
1. **学习成本**: 用户需要学习新的语法和快捷键
   - 解决方案: 提供详细文档和交互式教程

2. **数据安全**: 用户担心笔记数据的安全性
   - 解决方案: 本地存储，不上传用户数据

## 📊 性能指标

### 目标指标
- 扩展激活时间: < 500ms
- 链接解析响应时间: < 100ms
- 大文件（>1MB）处理时间: < 2s
- 内存占用: < 50MB（1000个文件）
- 索引建立时间: < 5s（1000个文件）
- 索引更新延迟: < 200ms（单文件更新）
- 索引查询响应: < 50ms（反向链接查询）
- 索引缓存命中率: > 90%
- 增量更新效率: < 100ms（单文件变更）

### 索引性能监控

#### 索引建立性能
```typescript
interface IndexPerformanceMetrics {
  // 建立阶段性能
  discoveryTime: number;        // 文件发现耗时
  parseTime: number;           // 解析阶段耗时
  indexBuildTime: number;      // 索引构建耗时
  totalIndexTime: number;      // 总索引建立时间
  
  // 文件处理性能
  filesCount: number;          // 处理的文件数量
  averageFileParseTime: number; // 平均文件解析时间
  
  // 内存使用情况
  memoryUsage: {
    beforeIndex: number;       // 索引前内存使用
    afterIndex: number;        // 索引后内存使用
    peakUsage: number;         // 峰值内存使用
  };
  
  // 索引数据统计
  indexStats: {
    totalLinks: number;        // 总链接数
    totalBacklinks: number;    // 总反向链接数
    totalTags: number;         // 总标签数
    orphanFiles: number;       // 孤立文件数
  };
}
```

#### 运行时性能监控
```typescript
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  recordOperation(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    const records = this.metrics.get(operation)!;
    records.push(duration);
    
    // 保持最近100次记录
    if (records.length > 100) {
      records.shift();
    }
  }
  
  getAverageTime(operation: string): number {
    const records = this.metrics.get(operation) || [];
    return records.length > 0 
      ? records.reduce((a, b) => a + b) / records.length 
      : 0;
  }
  
  getPerformanceReport(): PerformanceReport {
    return {
      indexQuery: this.getAverageTime('indexQuery'),
      linkResolve: this.getAverageTime('linkResolve'),
      fileUpdate: this.getAverageTime('fileUpdate'),
      cacheHitRate: this.calculateCacheHitRate()
    };
  }
}
```

### 监控方案
- 使用 VSCode 性能 API 监控关键操作
- 实现日志记录系统
- 定期进行性能基准测试
- 索引性能实时监控：记录索引建立、更新和查询的耗时
- 内存使用跟踪：监控索引数据的内存占用情况
- 缓存效率分析：统计缓存命中率和失效情况
- 批量操作优化：监控大量文件处理的性能表现

## 🤝 团队协作

### 代码规范
- 使用 ESLint + Prettier 统一代码风格
- 遵循 TypeScript 最佳实践
- 实施代码审查流程

### 分支管理
- `main`: 稳定版本分支
- `develop`: 开发分支
- `feature/*`: 功能开发分支
- `hotfix/*`: 紧急修复分支

### 提交规范
```
type(scope): description

- feat: 新功能
- fix: 修复
- docs: 文档更新
- style: 代码格式调整
- refactor: 重构
- test: 测试相关
- chore: 构建/工具相关
```

---

*本文档将随着项目进展持续更新。* 