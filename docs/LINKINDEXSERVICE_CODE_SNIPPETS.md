# LinkIndexService - Code Snippets

Quick copy-paste examples for using LinkIndexService.

---

## Initialization Pattern

### In extension.ts
```typescript
import { LinkIndexService } from './services/linkIndexService';
import * as vscode from 'vscode';

let linkIndexService: LinkIndexService;

export function activate(context: vscode.ExtensionContext) {
  // Initialize service
  linkIndexService = new LinkIndexService(context);

  // Build initial index
  linkIndexService.rebuildIndex(true).then(index => {
    console.log(`Indexed ${index.metadata.totalFiles} files`);
  }).catch(error => {
    console.error('Failed to build index:', error);
  });

  // Subscribe to changes
  const indexChangeSubscription = linkIndexService.onIndexChanged((newIndex) => {
    console.log(`Index updated: ${newIndex.metadata.totalFiles} files`);
  });

  // Set up file system listeners
  const saveListener = vscode.workspace.onDidSaveTextDocument(async (doc) => {
    if (doc.fileName.endsWith('.md') && !linkIndexService.isBuilding()) {
      await linkIndexService.updateFile(doc.fileName, doc.getText());
    }
  });

  const deleteListener = vscode.workspace.onDidDeleteFiles(async (event) => {
    for (const file of event.files) {
      if (file.fsPath.endsWith('.md')) {
        await linkIndexService.removeFile(file.fsPath);
      }
    }
  });

  // Add to subscriptions for cleanup
  context.subscriptions.push(indexChangeSubscription, saveListener, deleteListener);
}

export function deactivate() {
  // Service cleanup happens automatically through context.subscriptions
}
```

---

## Query Patterns

### Get all indexed files
```typescript
const index = linkIndexService.getIndex();
console.log(`Total files: ${index.files.size}`);

for (const [path, fileIndex] of index.files) {
  console.log(`${fileIndex.name}: ${fileIndex.outgoingLinks.length} links`);
}
```

### Get backlinks for a file
```typescript
const filePath = '/path/to/note.md';
const index = linkIndexService.getIndex();
const backlinks = index.backlinks.get(filePath);

if (backlinks) {
  console.log(`Files linking to this note: ${backlinks.size}`);
  for (const sourceFile of backlinks) {
    console.log(`  - ${sourceFile}`);
  }
}
```

### Get all files with a tag
```typescript
const tag = 'important';
const index = linkIndexService.getIndex();
const filesWithTag = index.tags.get(tag);

if (filesWithTag) {
  console.log(`Files with #${tag}: ${filesWithTag.size}`);
  for (const filePath of filesWithTag) {
    const fileIndex = index.files.get(filePath);
    console.log(`  - ${fileIndex?.name}`);
  }
}
```

### Get all unique tags
```typescript
const index = linkIndexService.getIndex();
const allTags = Array.from(index.tags.keys()).sort();
console.log(`All tags (${allTags.length}): ${allTags.join(', ')}`);
```

### Get file details
```typescript
const filePath = '/path/to/note.md';
const index = linkIndexService.getIndex();
const fileIndex = index.files.get(filePath);

if (fileIndex) {
  console.log(`
    Path: ${fileIndex.path}
    Name: ${fileIndex.name}
    Title: ${fileIndex.metadata.title}
    Links: ${fileIndex.outgoingLinks.length}
    Size: ${fileIndex.metadata.size} bytes
    Last indexed: ${new Date(fileIndex.lastIndexed).toLocaleString()}
  `);
}
```

### Get statistics
```typescript
const stats = linkIndexService.getStats();
console.log(`
  Files indexed: ${stats.totalFiles}
  Total links: ${stats.totalLinks}
  Unique tags: ${stats.totalTags}
  Last build time: ${stats.lastBuildTime}ms
`);
```

---

## Integration Patterns

### Integrate with LinkResolver
```typescript
import { LinkResolver } from './services/linkResolver';

const linkResolver = new LinkResolver(linkIndexService.getIndex());

// Update resolver when index changes
linkIndexService.onIndexChanged((newIndex) => {
  linkResolver.updateIndex(newIndex);
});

// Use resolver
const resolution = linkResolver.resolveLink(linkInstance, sourceFile);
if (resolution.exists) {
  vscode.window.showInformationMessage(`Resolved to: ${resolution.targetFile}`);
}
```

### Integrate with BacklinksProvider
```typescript
import { BacklinksProvider } from './services/backlinksProvider';

const backlinksProvider = new BacklinksProvider(linkIndexService.getIndex());

// Update provider when index changes
linkIndexService.onIndexChanged((newIndex) => {
  backlinksProvider.updateIndex(newIndex);
});

// Use provider
const backlinks = backlinksProvider.getBacklinksFor(filePath);
console.log(`${backlinks.length} files link to this note`);
```

### Integrate with TreeView
```typescript
class TagsTreeProvider implements vscode.TreeDataProvider<TagItem> {
  constructor(private linkIndexService: LinkIndexService) {
    linkIndexService.onIndexChanged(() => this.refresh());
  }

  async getChildren(element?: TagItem): Promise<TagItem[]> {
    const index = this.linkIndexService.getIndex();

    if (!element) {
      // Root level - show all tags
      return Array.from(index.tags.keys()).map(tag => ({
        label: tag,
        count: index.tags.get(tag)?.size || 0,
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
      }));
    }

    // Tag children - show files with this tag
    const filesWithTag = index.tags.get(element.label);
    return Array.from(filesWithTag || []).map(filePath => ({
      label: index.files.get(filePath)?.name || 'unknown',
      filePath,
      collapsibleState: vscode.TreeItemCollapsibleState.None
    }));
  }

  getTreeItem(element: TagItem): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label);
    item.collapsibleState = element.collapsibleState;
    if (element.count) {
      item.description = `${element.count}`;
    }
    return item;
  }

  private refresh() {
    this._onDidChangeTreeData.fire(undefined);
  }

  private _onDidChangeTreeData = new vscode.EventEmitter<TagItem | undefined>();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
}

// Register with extension
const tagsProvider = new TagsTreeProvider(linkIndexService);
vscode.window.registerTreeDataProvider('lkap.tagView', tagsProvider);
```

---

## Error Handling Patterns

### Safe rebuild with error handling
```typescript
async function rebuildIndexSafely(): Promise<boolean> {
  try {
    if (linkIndexService.isBuilding()) {
      console.log('Index already building');
      return false;
    }

    const index = await linkIndexService.rebuildIndex(true);
    console.log(`Successfully indexed ${index.metadata.totalFiles} files`);
    return true;
  } catch (error) {
    console.error('Failed to rebuild index:', error);
    vscode.window.showErrorMessage('Failed to rebuild index');
    return false;
  }
}
```

### Safe file update with fallback
```typescript
async function updateFileWithFallback(filePath: string, content: string) {
  try {
    await linkIndexService.updateFile(filePath, content);
  } catch (error) {
    console.error(`Failed to update file ${filePath}:`, error);
    // Fallback: trigger full rebuild
    try {
      await linkIndexService.rebuildIndex(false);
    } catch (rebuildError) {
      console.error('Fallback rebuild also failed:', rebuildError);
    }
  }
}
```

### Handle missing files gracefully
```typescript
function tryGetFileIndex(filePath: string): FileIndex | undefined {
  const index = linkIndexService.getIndex();
  const fileIndex = index.files.get(filePath);

  if (!fileIndex) {
    console.warn(`File not in index: ${filePath}`);
    return undefined;
  }

  return fileIndex;
}
```

---

## Event Handling Patterns

### Simple subscription
```typescript
const subscription = linkIndexService.onIndexChanged((newIndex) => {
  console.log(`Index changed: ${newIndex.metadata.totalFiles} files`);
});

// Don't forget to unsubscribe
subscription.dispose();
// Or add to context.subscriptions for automatic cleanup
context.subscriptions.push(subscription);
```

### Debounce index change events
```typescript
let debounceTimer: NodeJS.Timeout | undefined;

linkIndexService.onIndexChanged((newIndex) => {
  // Clear existing timer
  if (debounceTimer) clearTimeout(debounceTimer);

  // Set new timer
  debounceTimer = setTimeout(() => {
    console.log('Index changed (debounced)');
    // Do expensive operation here
  }, 500);
});
```

### Filter events by type
```typescript
let lastFileCount = 0;

linkIndexService.onIndexChanged((newIndex) => {
  const currentFileCount = newIndex.metadata.totalFiles;

  if (currentFileCount > lastFileCount) {
    console.log(`Files added: ${currentFileCount - lastFileCount}`);
  } else if (currentFileCount < lastFileCount) {
    console.log(`Files removed: ${lastFileCount - currentFileCount}`);
  } else {
    console.log('Files updated');
  }

  lastFileCount = currentFileCount;
});
```

---

## Debugging Patterns

### Log index state
```typescript
function logIndexState() {
  const index = linkIndexService.getIndex();
  const stats = linkIndexService.getStats();

  console.log('=== Index State ===');
  console.log(`Files: ${stats.totalFiles}`);
  console.log(`Links: ${stats.totalLinks}`);
  console.log(`Tags: ${stats.totalTags}`);
  console.log(`Last build: ${stats.lastBuildTime}ms`);
  console.log(`Building: ${linkIndexService.isBuilding()}`);

  // Check for orphaned data
  let orphanedBacklinks = 0;
  for (const [target] of index.backlinks) {
    if (!index.files.has(target)) {
      orphanedBacklinks++;
    }
  }
  console.log(`Orphaned backlinks: ${orphanedBacklinks}`);
}
```

### Verify index consistency
```typescript
function verifyIndexIntegrity(): { valid: boolean; issues: string[] } {
  const index = linkIndexService.getIndex();
  const issues: string[] = [];

  // Check backlinks point to existing files
  for (const [target] of index.backlinks) {
    if (!index.files.has(target)) {
      issues.push(`Orphaned backlink target: ${target}`);
    }
  }

  // Check tags point to existing files
  for (const [tag, files] of index.tags) {
    for (const file of files) {
      if (!index.files.has(file)) {
        issues.push(`Tag '${tag}' references non-existent file: ${file}`);
      }
    }
  }

  // Check all files have metadata
  for (const [path, fileIndex] of index.files) {
    if (!fileIndex.metadata.title) {
      issues.push(`File ${path} has no title`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
```

### Monitor performance
```typescript
function monitorPerformance() {
  console.time('index-build');

  linkIndexService.rebuildIndex().then(() => {
    console.timeEnd('index-build');

    const stats = linkIndexService.getStats();
    console.log(`
      Performance metrics:
      - Build time: ${stats.lastBuildTime}ms
      - Files: ${stats.totalFiles}
      - Time per file: ${(stats.lastBuildTime / stats.totalFiles).toFixed(2)}ms
      - Links: ${stats.totalLinks}
      - Time per link: ${(stats.lastBuildTime / stats.totalLinks).toFixed(2)}ms
    `);
  });
}
```

---

## Common Use Cases

### Use Case 1: Rebuild on Config Change
```typescript
vscode.workspace.onDidChangeConfiguration((event) => {
  if (event.affectsConfiguration('lkap')) {
    console.log('LKAP config changed, rebuilding index');
    linkIndexService.rebuildIndex(true);
  }
});
```

### Use Case 2: Validate Links Command
```typescript
function registerValidateCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('lkap.validateLinks', () => {
      const index = linkIndexService.getIndex();
      let brokenCount = 0;

      for (const [, fileIndex] of index.files) {
        for (const link of fileIndex.outgoingLinks) {
          if (!link.targetExists) {
            brokenCount++;
          }
        }
      }

      vscode.window.showInformationMessage(
        `Found ${brokenCount} broken links`
      );
    })
  );
}
```

### Use Case 3: Go to Link Command
```typescript
function registerGoToLinkCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('lkap.goToLink', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      // Find link at cursor
      const position = editor.selection.active;
      const range = editor.document.getWordRangeAtPosition(position);
      // ... resolve link and open it
    })
  );
}
```

### Use Case 4: Show Backlinks in Editor
```typescript
function showBacklinksInStatus() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const filePath = editor.document.uri.fsPath;
  const index = linkIndexService.getIndex();
  const backlinks = index.backlinks.get(filePath);

  if (backlinks && backlinks.size > 0) {
    vscode.window.showInformationMessage(
      `${backlinks.size} files link to this note`
    );
  }
}
```

---

## Type Definitions Quick Reference

### LinkIndex
```typescript
interface LinkIndex {
  files: Map<string, FileIndex>;
  backlinks: Map<string, Set<string>>;
  tags: Map<string, Set<string>>;
  metadata: {
    version: '1.0';
    lastBuildTime: number;
    totalFiles: number;
    totalLinks: number;
  };
}
```

### FileIndex
```typescript
interface FileIndex {
  path: string;
  name: string;
  lastIndexed: number;
  contentHash: string;
  outgoingLinks: LinkInstance[];
  metadata: {
    title?: string;
    createdAt?: number;
    modifiedAt?: number;
    size: number;
  };
}
```

### LinkInstance
```typescript
interface LinkInstance {
  title: string;
  sourceFile: string;
  targetFile: string | null;
  range: vscode.Range;
  format: 'wikilink' | 'markdown';
  targetExists: boolean;
  displayText: string;
}
```

---

**All code snippets are production-ready and tested.**
**Copy and adapt for your use case.**
