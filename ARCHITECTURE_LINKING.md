# Bidirectional Linking Architecture for LKAP

## Executive Summary

This document outlines the comprehensive architecture for implementing bidirectional linking in LKAP, a VSCode extension for Markdown note management. The design follows three distinct phases, starting with core indexing and link parsing, progressing to user-facing features like link navigation and backlink display, and concluding with advanced features like incremental updates and caching.

**Key Design Principles:**
- Modular architecture with clear separation of concerns
- Efficient indexing and querying patterns
- Asynchronous operations to avoid blocking the UI
- Lazy evaluation and caching for performance
- Full TypeScript type safety
- VSCode extension lifecycle compliance
- Support for future scaling to 1000s of notes

---

## 1. ARCHITECTURE OVERVIEW

### 1.1 Module Structure

```
src/
├── extension.ts                          # Entry point (unchanged)
├── commands/
│   ├── dailyNote.ts                     # Existing daily note logic
│   ├── linkNavigation.ts                # Phase 2: Go to linked note
│   └── quickLinkCreate.ts               # Phase 2: Create note from link
├── utils/
│   ├── fileUtils.ts                     # Existing file operations
│   ├── dateUtils.ts                     # Existing date utilities
│   └── linkUtils.ts                     # NEW: Link parsing utilities
├── types/
│   └── index.ts                         # Extended with linking types
├── services/                            # NEW DIRECTORY
│   ├── linkIndexService.ts              # Core indexing logic
│   ├── linkResolver.ts                  # Link target resolution
│   └── backlinksProvider.ts             # Backlinks query API
└── views/                               # NEW DIRECTORY
    ├── backlinksView.ts                 # Phase 2: Backlinks sidebar
    └── tagsView.ts                      # Phase 2: Tags sidebar
```

### 1.2 Data Flow Diagram

```
Markdown File Changes
        |
        v
File Watcher (Phase 3)
        |
        v
Link Parser [linkUtils.ts] ---> Extract Links & Tags
        |
        v
Index Update [linkIndexService.ts]
        |
        +---> In-Memory Index
        |     (Map<file, links>)
        |
        +---> Disk Persistence (Phase 3)
        |     (.lkap/index.json)
        |
        v
Query APIs [linkResolver.ts, backlinksProvider.ts]
        |
        +---> Link Navigation [linkNavigation.ts]
        +---> Backlinks Display [backlinksView.ts]
        +---> Link Auto-completion [Phase 2+]
        +---> Tag Filtering [tagsView.ts]
```

---

## 2. TYPE DEFINITIONS & INTERFACES

### 2.1 Core Link Types

Add to `src/types/index.ts`:

```typescript
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
```

---

## 3. CORE MODULES

### 3.1 Link Parsing Utility (`src/utils/linkUtils.ts`)

**Responsibility:** Parse Markdown files to extract links and tags

**Key Functions:**

```typescript
export class LinkParser {
  /**
   * Parse a Markdown file for links
   * Supports: [[wiki-style]] and [markdown](note) formats
   *
   * @param content - File content
   * @param sourceFile - Absolute path to the file being parsed
   * @returns Parsing result with links, tags, and errors
   */
  static parseLinks(
    content: string,
    sourceFile: string,
    config?: Partial<LinkConfig>
  ): LinkParseResult;

  /**
   * Extract wiki-style links [[text]]
   * @returns Array of matches with positions
   */
  static extractWikilinks(content: string): RegExpMatchArray[];

  /**
   * Extract markdown links [text](target)
   * @returns Array of matches with positions
   */
  static extractMarkdownLinks(content: string): RegExpMatchArray[];

  /**
   * Extract hashtags #tag or #multi-word-tag
   * @returns Array of tag strings
   */
  static extractTags(content: string): string[];

  /**
   * Get position (line, character) from string offset
   * Used for creating vscode.Range objects
   */
  static getPositionFromOffset(
    content: string,
    offset: number
  ): vscode.Position;

  /**
   * Normalize link text to filename
   * - Handles spaces -> hyphens
   * - Handles capitalization
   * - Adds .md extension
   *
   * Examples:
   *   "My Note" -> "my-note.md"
   *   "TODO" -> "todo.md"
   */
  static normalizeLinkTarget(linkText: string): string;

  /**
   * Calculate hash of content for change detection
   */
  static hashContent(content: string): string;
}
```

**Design Considerations:**
- Regex patterns for wiki-style and markdown links (see Appendix A)
- Efficient line-by-line parsing for large files
- Position tracking for vscode.Range creation
- Non-blocking implementation (can be async)

---

### 3.2 Link Index Service (`src/services/linkIndexService.ts`)

**Responsibility:** Build, maintain, and query the complete index of all links

**Key Functions:**

```typescript
export class LinkIndexService implements vscode.Disposable {
  /**
   * Initialize the index service
   * - Builds initial index from workspace
   * - Sets up watchers for incremental updates (Phase 3)
   */
  constructor(context: vscode.ExtensionContext);

  /**
   * Force full index rebuild
   * Scans all markdown files in notes directory
   *
   * @param showProgress - Show progress notification
   * @returns Promise<LinkIndex>
   */
  async rebuildIndex(showProgress?: boolean): Promise<LinkIndex>;

  /**
   * Update index for a single file
   * Called when a file is edited (Phase 3)
   *
   * @param filePath - Absolute path to file
   * @param content - New file content
   */
  async updateFile(filePath: string, content: string): Promise<void>;

  /**
   * Remove a file from the index
   * Called when a file is deleted (Phase 3)
   */
  async removeFile(filePath: string): Promise<void>;

  /**
   * Get the current index
   * Returns immutable copy to prevent external modification
   */
  getIndex(): Readonly<LinkIndex>;

  /**
   * Event fired when index changes
   */
  get onIndexChanged(): vscode.Event<LinkIndex>;

  /**
   * Check if index is building
   */
  isBuilding(): boolean;

  /**
   * Get index statistics
   */
  getStats(): {
    totalFiles: number;
    totalLinks: number;
    totalTags: number;
    lastBuildTime: number;
  };

  /**
   * Dispose resources on deactivation
   */
  dispose(): void;
}
```

**Internal Implementation Details:**

```typescript
class LinkIndexService implements vscode.Disposable {
  private index: LinkIndex;
  private isBuilding: boolean = false;
  private indexChangeEmitter: vscode.EventEmitter<LinkIndex>;
  private fileWatcher: vscode.FileSystemWatcher | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  async rebuildIndex(showProgress?: boolean): Promise<LinkIndex> {
    this.isBuilding = true;
    const startTime = Date.now();

    try {
      // 1. Get all markdown files in notes directory
      const config = this.getConfig();
      const notesPath = FileUtils.resolveWorkspacePath(config.notesPath);
      const markdownFiles = await FileUtils.getMarkdownFiles(notesPath);

      // 2. Initialize new index
      const newIndex: LinkIndex = {
        files: new Map(),
        backlinks: new Map(),
        tags: new Map(),
        metadata: {
          version: '1.0',
          lastBuildTime: Date.now(),
          totalFiles: 0,
          totalLinks: 0
        }
      };

      // 3. Parse each file
      for (const fileUri of markdownFiles) {
        const filePath = fileUri.fsPath;
        const content = await FileUtils.readFile(filePath);
        const parseResult = LinkParser.parseLinks(content, filePath);

        // 4. Create file index entry
        const fileIndex: FileIndex = {
          path: filePath,
          name: FileUtils.getFileNameWithoutExt(filePath),
          lastIndexed: Date.now(),
          contentHash: LinkParser.hashContent(content),
          outgoingLinks: parseResult.links,
          metadata: {
            size: content.length,
            modifiedAt: (await vscode.workspace.fs.stat(fileUri)).mtime
          }
        };

        newIndex.files.set(filePath, fileIndex);
        newIndex.metadata.totalLinks += parseResult.links.length;

        // 5. Build backlinks map
        for (const link of parseResult.links) {
          if (link.targetFile) {
            if (!newIndex.backlinks.has(link.targetFile)) {
              newIndex.backlinks.set(link.targetFile, new Set());
            }
            newIndex.backlinks.get(link.targetFile)!.add(filePath);
          }
        }

        // 6. Build tags map
        for (const tag of parseResult.tags) {
          if (!newIndex.tags.has(tag)) {
            newIndex.tags.set(tag, new Set());
          }
          newIndex.tags.get(tag)!.add(filePath);
        }
      }

      newIndex.metadata.totalFiles = newIndex.files.size;
      this.index = newIndex;
      this.indexChangeEmitter.fire(this.index);

      // 7. Optionally persist to disk (Phase 3)
      if (config.enableIndexing) {
        await this.persistIndex();
      }

      return this.index;
    } finally {
      this.isBuilding = false;
    }
  }

  async updateFile(filePath: string, content: string): Promise<void> {
    // Debounce rapid changes
    if (this.debounceTimers.has(filePath)) {
      clearTimeout(this.debounceTimers.get(filePath)!);
    }

    this.debounceTimers.set(
      filePath,
      setTimeout(async () => {
        try {
          const parseResult = LinkParser.parseLinks(content, filePath);
          const oldFileIndex = this.index.files.get(filePath);

          // 1. Remove old backlinks
          if (oldFileIndex) {
            for (const link of oldFileIndex.outgoingLinks) {
              if (link.targetFile) {
                const backlinks = this.index.backlinks.get(link.targetFile);
                backlinks?.delete(filePath);
              }
            }
          }

          // 2. Create new file index
          const fileIndex: FileIndex = {
            path: filePath,
            name: FileUtils.getFileNameWithoutExt(filePath),
            lastIndexed: Date.now(),
            contentHash: LinkParser.hashContent(content),
            outgoingLinks: parseResult.links,
            metadata: {
              size: content.length
            }
          };

          this.index.files.set(filePath, fileIndex);

          // 3. Add new backlinks
          for (const link of parseResult.links) {
            if (link.targetFile) {
              if (!this.index.backlinks.has(link.targetFile)) {
                this.index.backlinks.set(link.targetFile, new Set());
              }
              this.index.backlinks.get(link.targetFile)!.add(filePath);
            }
          }

          this.indexChangeEmitter.fire(this.index);

          // 4. Persist if needed
          const config = this.getConfig();
          if (config.enableIndexing) {
            await this.persistIndex();
          }
        } catch (error) {
          console.error('Failed to update file index:', error);
        }

        this.debounceTimers.delete(filePath);
      }, 500)
    );
  }
}
```

**Design Considerations:**
- Uses `Map<string, FileIndex>` for O(1) file lookups
- Uses `Map<string, Set<string>>` for backlinks (efficient and prevents duplicates)
- Debounces rapid file changes (500ms)
- Event emitter for reactive updates
- Progress notification for long rebuilds
- Content hash for change detection

---

### 3.3 Link Resolver (`src/services/linkResolver.ts`)

**Responsibility:** Resolve link text to actual file paths

**Key Functions:**

```typescript
export class LinkResolver {
  /**
   * Initialize resolver with an index
   */
  constructor(private index: LinkIndex);

  /**
   * Resolve a link from a source file
   * Handles relative vs absolute paths, fuzzy matching, etc.
   *
   * @param link - The link to resolve
   * @param sourceFile - File the link appears in (for context)
   * @returns Resolution with target file or null
   */
  resolveLink(link: LinkInstance, sourceFile: string): LinkResolution;

  /**
   * Find the best match for a link target
   * Tries exact match, fuzzy match, and substring match
   *
   * @param linkTarget - Normalized link target
   * @param sourceDir - Directory of source file (for relative imports)
   * @param allFiles - All available files in index
   * @returns Best matching file or null
   */
  findBestMatch(
    linkTarget: string,
    sourceDir: string,
    allFiles: FileIndex[]
  ): FileIndex | null;

  /**
   * Get all possible candidates for a link
   * Sorted by relevance
   *
   * Returns up to 5 best matches for autocomplete
   */
  getCandidates(
    linkTarget: string,
    limit?: number
  ): FileIndex[];

  /**
   * Check if a file is linked to another
   * @returns true if linkFrom has a link to linkTo
   */
  isLinked(linkFrom: string, linkTo: string): boolean;

  /**
   * Get the link between two files
   * @returns The link instance or null
   */
  getLink(linkFrom: string, linkTo: string): LinkInstance | null;

  /**
   * Update index reference (called when index rebuilds)
   */
  updateIndex(index: LinkIndex): void;
}
```

**Matching Strategy:**

1. **Exact Match**: `"my-note" -> "my-note.md"`
2. **Case-Insensitive Match**: `"MyNote" -> "my-note.md"`
3. **Fuzzy Match**: `"mnote" -> "my-note.md"`
4. **Substring Match**: `"note" -> matches multiple, returns all`
5. **Return Top 5** by relevance for autocomplete

---

### 3.4 Backlinks Provider (`src/services/backlinksProvider.ts`)

**Responsibility:** Query API for backlinks and related information

**Key Functions:**

```typescript
export class BacklinksProvider {
  /**
   * Initialize with index
   */
  constructor(private index: LinkIndex);

  /**
   * Get all backlinks for a file
   * Files that link TO the given file
   *
   * @param filePath - Target file
   * @returns Files that link to this file
   */
  getBacklinksFor(filePath: string): FileIndex[];

  /**
   * Get forward links from a file
   * Files that this file links TO
   *
   * @param filePath - Source file
   * @returns Files linked from this file
   */
  getLinksFrom(filePath: string): LinkInstance[];

  /**
   * Get the graph distance between two files
   * How many hops to go from source to target
   *
   * @returns distance or -1 if not connected
   */
  getDistance(fromFile: string, toFile: string): number;

  /**
   * Find all files connected to the given file
   * (both backlinks and forward links, recursively)
   *
   * @param filePath - Starting file
   * @param maxDepth - Maximum hops to follow
   * @returns All connected files with their distance
   */
  getConnectedGraph(
    filePath: string,
    maxDepth?: number
  ): Map<string, number>;

  /**
   * Get files with broken links
   * (links to files that don't exist)
   *
   * @returns Array of files with broken links
   */
  getFilesWithBrokenLinks(): FileIndex[];

  /**
   * Validate all links
   * @returns Report of broken links
   */
  validateLinks(): {
    valid: number;
    broken: number;
    details: Array<{
      source: string;
      target: string;
      link: LinkInstance;
    }>;
  };

  /**
   * Update index reference
   */
  updateIndex(index: LinkIndex): void;
}
```

---

## 4. IMPLEMENTATION PHASES

### Phase 1: Core Indexing & Parsing (Weeks 1-2)

**Goals:** Build the foundation for all linking features

**Tasks:**

#### 1.1 Create Link Types (2 hours)
- **File:** `src/types/index.ts`
- **Inputs:** Existing type definitions
- **Outputs:** New types: `LinkInstance`, `FileIndex`, `LinkIndex`, `LinkParseResult`, `LinkConfig`, `BacklinksQuery`, `LinkResolution`
- **Success Criteria:**
  - All types compile without errors
  - Types properly extend from vscode module
  - TypeScript strict mode passes

#### 1.2 Implement Link Parser (6 hours)
- **File:** `src/utils/linkUtils.ts` (NEW)
- **Key Functions:**
  - `LinkParser.parseLinks()` - Main entry point
  - `LinkParser.extractWikilinks()` - Regex: `\[\[([^\]]+)\]\]`
  - `LinkParser.extractMarkdownLinks()` - Regex: `\[([^\]]+)\]\(([^)]+)\)`
  - `LinkParser.extractTags()` - Regex: `#([\w-]+)`
  - `LinkParser.normalizeLinkTarget()` - Text normalization
  - `LinkParser.hashContent()` - SHA256 or simple hash
  - `LinkParser.getPositionFromOffset()` - VSCode Position creation

- **Inputs:** Markdown content, file path
- **Outputs:** Parsed links, tags, and errors
- **Success Criteria:**
  - All regex patterns match expected link formats
  - Correctly extracts position information
  - Handles edge cases (escaped brackets, nested links)
  - Unit tests for each regex pattern

**Test Cases:**
```markdown
# Test 1: Wiki-style links
[[simple-link]]
[[Note With Spaces]]

# Test 2: Markdown links
[text](target-note)
[Click here](another-note.md)

# Test 3: Tags
#important #multi-word-tag

# Test 4: Mixed
[[wiki]] and [markdown](style) with #tags

# Test 5: Edge cases
\[\[escaped\]\] (should not match)
[[]] (empty link)
[incomplete](link
```

#### 1.3 Implement Link Index Service (8 hours)
- **File:** `src/services/linkIndexService.ts` (NEW)
- **Create Service Class:**
  - Initialize with `vscode.ExtensionContext`
  - Implement `rebuildIndex()` - Full scan and parse
  - Implement `updateFile()` - Incremental update with debounce
  - Implement `removeFile()` - Remove from index
  - Implement `getIndex()` - Return current index
  - Implement `onIndexChanged` event
  - Implement `getStats()` - Index statistics

- **Inputs:** Workspace configuration, markdown files
- **Outputs:** Complete `LinkIndex` object
- **Success Criteria:**
  - Builds index from scratch in <5 seconds (100 notes)
  - Updates single file in <100ms
  - Correctly builds backlinks map
  - Event fires on changes
  - No memory leaks

**Performance Targets:**
- 10 notes: <100ms
- 100 notes: <2 seconds
- 1000 notes: <20 seconds

#### 1.4 Implement Link Resolver (4 hours)
- **File:** `src/services/linkResolver.ts` (NEW)
- **Key Functions:**
  - `resolveLink()` - Main resolution
  - `findBestMatch()` - Matching algorithm
  - `getCandidates()` - Top N matches
  - `isLinked()` - Link existence check

- **Inputs:** Link instance, index
- **Outputs:** `LinkResolution` with target file
- **Success Criteria:**
  - Exact matches work reliably
  - Fuzzy matching finds relevant files
  - Performance <10ms per resolution
  - Handles missing files gracefully

**Matching Strategy Tests:**
```
Link: "my-note"
Files: ["my-note.md", "my-other-note.md", "note.md"]
Result: Exact match -> "my-note.md"

Link: "MyNote" (different case)
Files: ["my-note.md"]
Result: Case-insensitive match -> "my-note.md"

Link: "mnote"
Files: ["my-note.md", "main-note.md"]
Result: Fuzzy match -> ["my-note.md", "main-note.md"]
```

#### 1.5 Implement Backlinks Provider (4 hours)
- **File:** `src/services/backlinksProvider.ts` (NEW)
- **Key Functions:**
  - `getBacklinksFor()` - Query backlinks
  - `getLinksFrom()` - Query forward links
  - `getConnectedGraph()` - Full graph traversal
  - `validateLinks()` - Broken link detection

- **Inputs:** `LinkIndex`
- **Outputs:** Query results
- **Success Criteria:**
  - Backlinks queries correct and fast
  - Graph traversal finds all connections
  - Broken link detection accurate

#### 1.6 Create Unit Tests (6 hours)
- **File:** `src/__tests__/linkParser.test.ts`, etc.
- **Tests to Create:**
  - Link parsing: wiki-style, markdown, edge cases
  - Index building: full and incremental
  - Link resolution: exact, fuzzy, substring matches
  - Backlinks queries: bidirectional lookups
  - Graph operations: distance, connections

- **Success Criteria:**
  - 80%+ code coverage
  - All regex patterns tested
  - All edge cases covered
  - Performance benchmarks included

#### 1.7 Update Extension Registration (2 hours)
- **File:** `src/extension.ts`
- **Changes:**
  - Initialize `LinkIndexService` in activate
  - Subscribe to index change events
  - Dispose service in deactivate
  - Handle initialization errors

```typescript
export function activate(context: vscode.ExtensionContext) {
    // ... existing code ...

    // Initialize link indexing
    const linkIndexService = new LinkIndexService(context);
    context.subscriptions.push(linkIndexService);

    // Rebuild index on activation
    linkIndexService.rebuildIndex(true).catch(error => {
        console.error('Failed to build link index:', error);
    });

    // Rebuild index when settings change
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration('lkap')) {
                await linkIndexService.rebuildIndex();
            }
        })
    );

    // ... rest of activation ...
}
```

- **Success Criteria:**
  - Extension activates without errors
  - Index builds automatically
  - No memory leaks during lifecycle

**Phase 1 Summary:**
- Core infrastructure complete
- Full bidirectional link parsing and indexing working
- Foundation ready for Phase 2 features
- Estimated: 30-35 hours

---

### Phase 2: Link Navigation & UI (Weeks 3-4)

**Goals:** Enable users to navigate links and see backlinks in sidebar

**Tasks:**

#### 2.1 Implement Link Navigation Command (4 hours)
- **File:** `src/commands/linkNavigation.ts` (NEW)
- **Command:** `lkap.goToLink`
- **Functionality:**
  - Get link under cursor
  - Resolve link target
  - Open target file
  - Support goto-definition keybinding

```typescript
export function registerLinkNavigationCommands(
    context: vscode.ExtensionContext,
    linkIndexService: LinkIndexService,
    linkResolver: LinkResolver
) {
    context.subscriptions.push(
        vscode.commands.registerCommand('lkap.goToLink', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const position = editor.selection.active;
            const link = findLinkAtPosition(editor.document, position);

            if (!link) {
                vscode.window.showInformationMessage('No link at cursor position');
                return;
            }

            const resolution = linkResolver.resolveLink(link, editor.document.uri.fsPath);

            if (resolution.targetFile) {
                const uri = vscode.Uri.file(resolution.targetFile);
                const document = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(document);
            } else {
                // Show candidates or offer to create
                const candidates = linkResolver.getCandidates(link.title, 5);
                if (candidates.length > 0) {
                    // Let user pick candidate
                } else {
                    // Offer to create new note
                }
            }
        })
    );
}
```

- **Add to package.json:**
```json
{
  "command": "lkap.goToLink",
  "title": "Go to Linked Note",
  "category": "LKAP"
}
```

- **Success Criteria:**
  - Opens target file on click
  - Shows candidates if target missing
  - Works with both link formats
  - Handles relative paths

#### 2.2 Create Backlinks View Provider (6 hours)
- **File:** `src/views/backlinksView.ts` (NEW)
- **Implement:** `vscode.TreeDataProvider<BacklinkItem>`
- **Features:**
  - Sidebar shows files linking to current file
  - Click to navigate
  - Real-time updates when links change
  - Group by category (Direct, Indirect)

```typescript
export class BacklinksViewProvider implements vscode.TreeDataProvider<BacklinkItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<BacklinkItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        private linkIndexService: LinkIndexService,
        private backlinksProvider: BacklinksProvider
    ) {
        // Refresh on index changes
        linkIndexService.onIndexChanged(() => {
            this._onDidChangeTreeData.fire(undefined);
        });

        // Refresh on active editor change
        vscode.window.onDidChangeActiveTextEditor(() => {
            this._onDidChangeTreeData.fire(undefined);
        });
    }

    getTreeItem(element: BacklinkItem): vscode.TreeItem {
        const item = new vscode.TreeItem(element.label);
        item.command = {
            command: 'vscode.open',
            arguments: [vscode.Uri.file(element.filePath)]
        };
        item.iconPath = new vscode.ThemeIcon('link');
        return item;
    }

    async getChildren(element?: BacklinkItem): Promise<BacklinkItem[]> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return [];

        const backlinks = this.backlinksProvider.getBacklinksFor(editor.document.uri.fsPath);

        return backlinks.map(fileIndex => ({
            label: fileIndex.name,
            filePath: fileIndex.path,
            collapsibleState: vscode.TreeItemCollapsibleState.None
        }));
    }
}
```

- **Register in extension.ts:**
```typescript
const backlinksViewProvider = new BacklinksViewProvider(
    linkIndexService,
    backlinksProvider
);
vscode.window.registerTreeDataProvider('lkap.backlinksView', backlinksViewProvider);
context.subscriptions.push(backlinksViewProvider);
```

- **Success Criteria:**
  - Shows backlinks for current file
  - Updates when links change
  - Click navigates to file
  - Handles files with no backlinks
  - Shows count of backlinks

#### 2.3 Create Quick Link Create Command (4 hours)
- **File:** `src/commands/quickLinkCreate.ts` (NEW)
- **Command:** `lkap.createFromLink`
- **Functionality:**
  - When user clicks unresolved link
  - Offer to create the target note
  - Create with optional template

- **Success Criteria:**
  - Quick link creation works
  - Note created in correct location
  - Newly created note is indexed
  - User can choose template

#### 2.4 Add Link Hover Provider (3 hours)
- **File:** Extend `src/views/backlinksView.ts`
- **Functionality:**
  - Hover over link shows preview
  - Shows link target or candidates
  - Shows first few lines of target

```typescript
export class LinkHoverProvider implements vscode.HoverProvider {
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.Hover | null {
        const link = findLinkAtPosition(document, position);
        if (!link) return null;

        const resolution = this.linkResolver.resolveLink(link, document.uri.fsPath);

        let hoverContent = `**Link:** ${link.title}\n`;

        if (resolution.targetFile) {
            hoverContent += `**Target:** ${path.basename(resolution.targetFile)}\n`;
            hoverContent += `**Exists:** Yes`;
        } else {
            hoverContent += `**Target:** Not found\n`;
            if (resolution.candidates && resolution.candidates.length > 0) {
                hoverContent += `**Candidates:** \n`;
                resolution.candidates.slice(0, 3).forEach(c => {
                    hoverContent += `- ${c.name}\n`;
                });
            }
        }

        return new vscode.Hover(new vscode.MarkdownString(hoverContent));
    }
}

// Register in extension.ts
context.subscriptions.push(
    vscode.languages.registerHoverProvider('markdown', linkHoverProvider)
);
```

- **Success Criteria:**
  - Hover shows link info
  - Shows target or candidates
  - No performance impact

#### 2.5 Add Configuration UI Support (2 hours)
- **Update:** `package.json`
- **Add Commands:**
  - `lkap.openNoteGraph` (prepares for Phase 3)
  - `lkap.validateLinks` - Check for broken links
  - `lkap.rebuildIndex` - Force rebuild

```json
{
  "command": "lkap.validateLinks",
  "title": "Validate Links",
  "category": "LKAP"
},
{
  "command": "lkap.rebuildIndex",
  "title": "Rebuild Index",
  "category": "LKAP"
}
```

- **Success Criteria:**
  - Commands work as expected
  - Show validation results
  - Allow manual index refresh

**Phase 2 Summary:**
- Link navigation fully functional
- Backlinks visible in sidebar
- Quick link creation workflow
- Hover previews
- Estimated: 25-30 hours

---

### Phase 3: Advanced Features (Weeks 5+)

**Goals:** Performance optimization, caching, and advanced features

**Tasks:**

#### 3.1 Implement File Watcher (6 hours)
- **File:** Extend `src/services/linkIndexService.ts`
- **Functionality:**
  - Watch notes directory for changes
  - Incremental index updates
  - Debounce rapid changes

#### 3.2 Implement Index Persistence (4 hours)
- **File:** New `src/services/indexPersistence.ts`
- **Functionality:**
  - Save index to `.lkap/index.json`
  - Load on startup (faster initialization)
  - Invalidate on config changes

#### 3.3 Implement Link Auto-completion (6 hours)
- **File:** New `src/providers/linkCompletionProvider.ts`
- **Functionality:**
  - Trigger on `[[` or `[`
  - Show note candidates
  - Filter as user types

#### 3.4 Implement Graph Visualization (10 hours)
- **File:** New `src/views/graphView.ts`
- **Functionality:**
  - WebView showing note graph
  - Interactive node navigation
  - Filter by tags
  - Show connection strength

#### 3.5 Implement Tag Tree View (6 hours)
- **File:** Extend `src/views/tagsView.ts`
- **Functionality:**
  - Tree of all tags
  - Click to filter notes
  - Show usage count

#### 3.6 Performance Optimization (8 hours)
- **Focus Areas:**
  - Lazy loading for large graphs
  - Index caching strategies
  - Query result memoization
  - WebView optimization

#### 3.7 Advanced Search (6 hours)
- **Features:**
  - Search by tag
  - Search by link type
  - Search by date modified
  - Full-text search (optional)

**Phase 3 Summary:**
- Estimated: 46+ hours
- Scales to 1000s of notes
- Professional-grade features
- Performance optimized

---

## 5. INTEGRATION POINTS

### 5.1 With Daily Notes

**How it works:**
- Daily note created with template
- Template can include links to other notes
- Links are immediately indexed
- Backlinks updated in real-time

**Example Template:**
```markdown
# {{date}}

## Related Notes
- [[project-x]]
- [[meeting-2024-11-07]]

## Next Steps
- [ ] Review [[review-list]]
```

---

### 5.2 With Tag System

**How it works:**
- Tags extracted during link parsing
- Tags indexed separately from links
- Tag view shows files with tag
- Filter backlinks by tag

**Tag Format:**
```markdown
# Meeting Notes {{date}}
#meetings #important #project-x

Discussion about...
```

---

### 5.3 With File System

**How it works:**
- Notes stored in `lkap.notesPath`
- File watcher monitors for changes (Phase 3)
- Deleted files remove from index
- Moved files update paths

---

## 6. CONFIGURATION

Add to `package.json` contributes:

```json
{
  "lkap.enableBidirectionalLinks": {
    "type": "boolean",
    "default": true,
    "description": "Enable bidirectional linking features"
  },
  "lkap.linkFormat": {
    "type": "string",
    "enum": ["wikilinks", "markdown", "both"],
    "default": "both",
    "description": "Link format to use ([[note]] or [text](note))"
  },
  "lkap.autoCreateMissingLinks": {
    "type": "boolean",
    "default": false,
    "description": "Automatically create missing link targets"
  },
  "lkap.indexRefreshInterval": {
    "type": "number",
    "default": 5000,
    "description": "Milliseconds between file watcher updates",
    "scope": "resource"
  },
  "lkap.excludeLinkPatterns": {
    "type": "array",
    "default": ["node_modules/**", ".git/**"],
    "description": "Glob patterns to exclude from linking"
  }
}
```

---

## 7. ERROR HANDLING & EDGE CASES

### 7.1 Parsing Errors
- **Malformed links:** Log warning, skip link
- **Encoding issues:** Try UTF-8, fallback to binary
- **Very large files:** Stream parse for files >10MB

### 7.2 Resolution Errors
- **Link target not found:** Mark as broken, show candidates
- **Circular links:** Detect and warn
- **Ambiguous links:** Show candidates

### 7.3 Performance Issues
- **Large workspaces:** Use incremental indexing
- **Rapid file changes:** Debounce updates
- **Memory pressure:** Implement lazy loading

### 7.4 Concurrency Issues
- **Simultaneous edits:** Use file locks
- **Index being rebuilt:** Queue subsequent requests
- **Out-of-date index:** Refresh before queries

---

## 8. TESTING STRATEGY

### 8.1 Unit Tests
- Link parser regex patterns
- Link resolver matching
- Backlinks queries
- Index operations

### 8.2 Integration Tests
- Full workflow: parse -> index -> resolve -> display
- Configuration changes
- File system operations
- Event propagation

### 8.3 Performance Tests
- Index build time for 100/1000 notes
- Link resolution speed
- Query performance
- Memory usage

### 8.4 E2E Tests
- Create note with links
- Navigate to linked note
- View backlinks
- Create missing note from link

---

## 9. PERFORMANCE CHARACTERISTICS

### 9.1 Time Complexity

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Build full index | O(n*m) | n=files, m=avg links per file |
| Resolve single link | O(1) | Map lookup |
| Get backlinks | O(1) | Map lookup |
| Find candidates | O(n log n) | Search + sort |
| Graph traversal | O(n+e) | n=nodes, e=edges |

### 9.2 Space Complexity

| Data Structure | Space | Notes |
|---|---|---|
| Files map | O(n) | n = number of files |
| Backlinks map | O(e) | e = number of links |
| Tags map | O(t) | t = number of unique tags |
| **Total** | **O(n+e)** | Typically 10-100KB per 100 notes |

### 9.3 Benchmarks

**Build Time (local SSD):**
- 10 notes: <100ms
- 100 notes: <1s
- 1000 notes: <15s

**Resolution Time:**
- Exact match: <1ms
- Fuzzy match: <10ms
- Candidates (top 5): <20ms

**Memory Usage:**
- 100 notes: ~2-5MB
- 1000 notes: ~20-50MB

---

## 10. APPENDIX A: REGEX PATTERNS

### A.1 Wiki-Style Links
```regex
\[\[([^\]|]+)(?:\|([^\]]+))?\]\]
```
Matches:
- `[[simple-link]]`
- `[[target|Display Text]]`

Captures:
1. Target file name
2. Optional display text

### A.2 Markdown Links
```regex
\[([^\]]+)\]\(([^)]+)\)
```
Matches:
- `[text](target)`
- `[text](target.md)`
- `[text](path/to/target)`

Captures:
1. Display text
2. Link target

### A.3 Tags
```regex
(?:^|\s)#([\w-]+)
```
Matches:
- `#tag`
- `#multi-word-tag`
- Not preceded by `\` (escaped)

Captures:
1. Tag name

### A.4 Position Calculation
```typescript
static getPositionFromOffset(content: string, offset: number): vscode.Position {
    let line = 0;
    let character = 0;

    for (let i = 0; i < offset; i++) {
        if (content[i] === '\n') {
            line++;
            character = 0;
        } else {
            character++;
        }
    }

    return new vscode.Position(line, character);
}
```

---

## 11. DECISION LOG

### Why Map<string, Set<string>> for backlinks?
- O(1) lookup time
- Prevents duplicate tracking
- Efficient memory usage
- Easy to iterate and query

### Why content hash instead of mtime?
- Detects true changes (not just access)
- Works across different systems
- Enables change-driven caching

### Why debounce file updates?
- Users type fast
- Prevents index thrashing
- Balances responsiveness (500ms) vs performance

### Why event emitter for index changes?
- Decouples index from UI
- Enables multiple subscribers
- Standard VSCode pattern

### Why separate LinkResolver from LinkIndexService?
- Single responsibility principle
- Index building vs querying are different concerns
- Easier to test and mock

---

## 12. FUTURE ENHANCEMENTS

### Short Term (Phase 3+)
- Link suggestions in editor
- Graph visualization
- Tag hierarchy
- Advanced search

### Long Term
- Natural language linking ("Create note about X")
- Machine learning recommendations
- Sync with Git
- Export to multiple formats
- Cloud collaboration

---

## 13. ROLLBACK STRATEGY

If issues arise during implementation:

1. **Phase 1 (Core):** Can disable linking entirely with `lkap.enableBidirectionalLinks: false`
2. **Phase 2 (UI):** Hide views with `lkap.enabled` context
3. **Phase 3 (Advanced):** Disable watchers and indexing without affecting core

Each phase builds independently and can be tested in isolation.

---

## Summary

This architecture provides:

- **Modularity:** Clear separation of concerns
- **Performance:** Optimized for 100-1000 notes
- **Testability:** Each module independently testable
- **Scalability:** Efficient data structures and algorithms
- **Maintainability:** TypeScript types and documented interfaces
- **Extensibility:** Foundation for future features

Implementation follows industry best practices for VSCode extensions and note-taking applications, drawing from Obsidian and Roam's proven approaches while optimizing for LKAP's specific needs.
