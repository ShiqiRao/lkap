# Bidirectional Linking - Quick Reference & Decision Guide

A companion to `ARCHITECTURE_LINKING.md` and `LINKING_IMPLEMENTATION_TASKS.md`.

---

## Quick Module Reference

### Core Services (Phase 1)

```
LinkParser (linkUtils.ts)
├── parseLinks(content, file) -> LinkParseResult
├── extractWikilinks() -> matches[]
├── extractMarkdownLinks() -> matches[]
├── extractTags() -> tags[]
├── normalizeLinkTarget() -> filename
├── hashContent() -> hash
└── getPositionFromOffset() -> vscode.Position

LinkIndexService (linkIndexService.ts)
├── rebuildIndex(showProgress) -> LinkIndex
├── updateFile(path, content) -> void
├── removeFile(path) -> void
├── getIndex() -> LinkIndex
├── getStats() -> stats
└── onIndexChanged -> Event

LinkResolver (linkResolver.ts)
├── resolveLink(link, sourceFile) -> LinkResolution
├── findBestMatch(target, dir, files) -> FileIndex
├── getCandidates(target, limit) -> FileIndex[]
├── isLinked(from, to) -> boolean
└── getLink(from, to) -> LinkInstance | null

BacklinksProvider (backlinksProvider.ts)
├── getBacklinksFor(file) -> FileIndex[]
├── getLinksFrom(file) -> LinkInstance[]
├── getDistance(from, to) -> number
├── getConnectedGraph(file, maxDepth) -> Map
├── getFilesWithBrokenLinks() -> FileIndex[]
└── validateLinks() -> report
```

### User-Facing Commands (Phase 2)

```
Link Navigation (linkNavigation.ts)
└── lkap.goToLink
    ├── Ctrl+Click or Cmd+Click
    ├── Context menu item
    └── Opens linked note or shows candidates

Quick Link Create (quickLinkCreate.ts)
└── lkap.createFromLink
    ├── Creates missing link target
    ├── Shows input dialog
    └── Opens new file

Validation (validationCommands.ts)
├── lkap.validateLinks
│   └── Reports broken links
└── lkap.rebuildIndex
    └── Force full rebuild
```

### UI Views (Phase 2)

```
Backlinks View (backlinksView.ts)
├── Tree of files linking to current file
├── Click to navigate
├── Real-time updates
└── Shows backlink count

Hover Provider (linkHoverProvider.ts)
├── Shows on hover over link
├── Displays target/candidates
├── Shows existence status
└── Performance: <1ms
```

---

## Data Structure Quick Reference

```typescript
// Minimal example
LinkInstance: {
  title: "my-note",
  sourceFile: "/path/to/current.md",
  targetFile: "/path/to/my-note.md",
  format: "wikilink",
  displayText: "my-note"
}

FileIndex: {
  path: "/path/to/file.md",
  name: "file",
  lastIndexed: 1699360000000,
  contentHash: "abc123...",
  outgoingLinks: [LinkInstance, ...],
  metadata: { size: 2048, modifiedAt: ... }
}

LinkIndex: {
  files: Map {
    "/path/to/file1.md" -> FileIndex,
    "/path/to/file2.md" -> FileIndex,
    ...
  },
  backlinks: Map {
    "/path/to/target.md" -> Set ["/path/to/source1.md", ...]
  },
  tags: Map {
    "important" -> Set ["/path/to/file1.md", ...],
    ...
  }
}
```

---

## Key Decision Points

### 1. Link Format Support
**Question:** Should we support [[wiki]] links, [markdown](links), or both?

**Decision:** Both (wikilinks + markdown)
**Rationale:**
- Wikilinks faster to type and more distinctive
- Markdown more portable and standards-compliant
- Users may have preference
- Both easily distinguishable in index

**Implementation:**
```typescript
LinkConfig: {
  enableWikilinks: true,
  enableMarkdownLinks: true
}
```

**If change needed:** Add feature flag, parse based on config

---

### 2. Link Target Resolution
**Question:** What matching strategy for "my-note" -> "my-note.md"?

**Decision:** Tiered approach
1. Exact match (case-sensitive)
2. Case-insensitive match
3. Fuzzy match (Levenshtein)
4. Substring match (return candidates)

**Rationale:**
- Fast common case (exact match)
- Tolerant of user input variations
- Provides candidates for ambiguous cases
- Users can confirm intention

**If change needed:** Adjust scoring in LinkResolver.findBestMatch()

---

### 3. Backlinks Storage
**Question:** Should backlinks be eagerly built or lazily computed?

**Decision:** Eagerly built during indexing
**Rationale:**
- O(1) query time when viewing
- Small overhead during build (negligible)
- Real-time updates easier
- Simpler implementation

**Performance:** ~10% overhead on build time
**If change needed:** Implement lazy computation in BacklinksProvider

---

### 4. Index Persistence
**Question:** Should index be saved to disk?

**Decision:** Phase 3 (not Phase 1)
**Rationale:**
- Phase 1 focuses on core functionality
- Persistence adds complexity
- Not needed for MVP
- Can be added later without breaking changes

**Phase 3 Location:** `.lkap/index.json` (hidden directory)
**If needed early:** Can implement with minimal changes (see 3.2 in tasks)

---

### 5. File Watching
**Question:** Should index update incrementally on file changes?

**Decision:** Phase 3 (not Phase 1)
**Rationale:**
- Full rebuild on activation sufficient for Phase 1
- Incremental updates add complexity
- Users can use "Rebuild Index" command
- Auto-refresh can be added in Phase 3

**Phase 3 Plan:** File watcher + debounced updates
**If needed early:** Can implement file watcher separately

---

### 6. Cycle Detection
**Question:** How to handle circular links (A->B->C->A)?

**Decision:** Allow cycles, detect for validation
**Rationale:**
- Common in knowledge bases
- Valid use case for relationships
- Detect in validateLinks()
- Show warning, not error

**Implementation:** Cycle detection in graph traversal
**If needed:** Add config to forbid cycles

---

### 7. Performance Scaling
**Question:** How many notes should we support?

**Decision:** 100-1000 notes (target), scales beyond
**Rationale:**
- 100: <2s rebuild, < 10MB memory (very comfortable)
- 1000: <20s rebuild, <100MB memory (acceptable)
- Beyond: Would need optimization (Phase 3)

**Benchmarks:** See ARCHITECTURE_LINKING.md section 9

**If needed:** Implement caching, partial indexing, background builds

---

## Regex Pattern Reference

### Wiki-Style Links: `\[\[([^\]|]+)(?:\|([^\]]+))?\]\]`

```markdown
Input: [[my-note]]
Captures: (1: "my-note")

Input: [[my-note|Display Text]]
Captures: (1: "my-note", 2: "Display Text")

Input: \[\[escaped\]\]
Matches: No (with proper escape handling)
```

### Markdown Links: `\[([^\]]+)\]\(([^)]+)\)`

```markdown
Input: [text](target)
Captures: (1: "text", 2: "target")

Input: [my link](my-note.md)
Captures: (1: "my link", 2: "my-note.md")
```

### Tags: `(?:^|\s)#([\w-]+)`

```markdown
Input: This is #important
Captures: (1: "important")

Input: #tag1 #tag2
Captures: Multiple matches: (1: "tag1"), (1: "tag2")
```

---

## Integration Checklist

Before each phase, verify integration with:

### Phase 1
- [ ] Daily note creation still works
- [ ] Template system unaffected
- [ ] File utilities accessible
- [ ] Configuration system accessible
- [ ] No conflicts with existing types

### Phase 2
- [ ] Hover providers don't conflict
- [ ] Commands properly registered
- [ ] Views registered and visible
- [ ] Context menus working
- [ ] Extension lifecycle respected

### Phase 3
- [ ] File watchers don't impact performance
- [ ] Persistence doesn't break on config change
- [ ] Auto-completion triggers correctly
- [ ] Graph visualization renders
- [ ] Tag tree updates in real-time

---

## Troubleshooting Guide

### Issue: Index not building
**Checks:**
1. Notes directory exists and is readable
2. Configuration `lkap.notesPath` correct
3. Markdown files present in directory
4. FileUtils.getMarkdownFiles() returns results
5. Check console for errors

**Debug:**
```typescript
// In extension.ts
console.log('Notes path:', FileUtils.resolveWorkspacePath(config.notesPath));
console.log('Files found:', await FileUtils.getMarkdownFiles(...));
```

### Issue: Links not resolving
**Checks:**
1. LinkParser correctly extracts links
2. Target files exist
3. LinkResolver matching strategy working
4. File normalization correct (spaces -> hyphens)
5. Check console for resolution errors

**Debug:**
```typescript
// Test parsing
const result = LinkParser.parseLinks(content, file);
console.log('Extracted links:', result.links);

// Test resolution
const resolution = linkResolver.resolveLink(link, sourceFile);
console.log('Resolved to:', resolution.targetFile);
```

### Issue: Backlinks not updating
**Checks:**
1. Index rebuilds on file change
2. onIndexChanged event fires
3. BacklinksProvider updated on event
4. Tree data provider refreshed
5. Check file watcher (Phase 3)

**Debug:**
```typescript
// Subscribe to events
linkIndexService.onIndexChanged(() => {
  console.log('Index changed, backlinks:',
    backlinksProvider.getBacklinksFor(currentFile));
});
```

### Issue: Performance slow
**Checks:**
1. Index size reasonable (<100MB for 1000 notes)
2. No memory leaks in services
3. Query results cached if possible
4. File watcher debounced (Phase 3)
5. UI updates optimized

**Debug:**
```typescript
// Monitor performance
console.time('rebuildIndex');
await linkIndexService.rebuildIndex();
console.timeEnd('rebuildIndex');

// Monitor memory
console.log('Memory:', process.memoryUsage());
```

---

## API Usage Examples

### For Command Developers

```typescript
// In a command handler
export function registerMyCommand(
  context: vscode.ExtensionContext,
  linkResolver: LinkResolver,
  backlinksProvider: BacklinksProvider
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('lkap.myCommand', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      // Get file
      const filePath = editor.document.uri.fsPath;

      // Get backlinks
      const backlinks = backlinksProvider.getBacklinksFor(filePath);
      console.log('Files linking to this:', backlinks.map(f => f.name));

      // Resolve a link
      const link: LinkInstance = { ... };
      const resolution = linkResolver.resolveLink(link, filePath);
      if (resolution.targetFile) {
        // Open it
        const doc = await vscode.workspace.openTextDocument(
          vscode.Uri.file(resolution.targetFile)
        );
        await vscode.window.showTextDocument(doc);
      }
    })
  );
}
```

### For UI View Developers

```typescript
// In a tree data provider
export class MyTreeProvider implements vscode.TreeDataProvider<MyItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<MyItem>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private indexService: LinkIndexService,
    private backlinksProvider: BacklinksProvider
  ) {
    // Refresh when index changes
    indexService.onIndexChanged(() => {
      this._onDidChangeTreeData.fire(undefined);
    });
  }

  async getChildren(element?: MyItem) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return [];

    const backlinks = this.backlinksProvider.getBacklinksFor(
      editor.document.uri.fsPath
    );

    return backlinks.map(file => ({
      label: file.name,
      filePath: file.path
    }));
  }

  getTreeItem(element: MyItem) {
    const item = new vscode.TreeItem(element.label);
    item.command = {
      command: 'vscode.open',
      arguments: [vscode.Uri.file(element.filePath)]
    };
    return item;
  }
}
```

---

## Configuration Schema Reference

```json
{
  "lkap.enableBidirectionalLinks": {
    "type": "boolean",
    "default": true,
    "description": "Enable all linking features"
  },
  "lkap.linkFormat": {
    "type": "string",
    "enum": ["wikilinks", "markdown", "both"],
    "default": "both"
  },
  "lkap.autoCreateMissingLinks": {
    "type": "boolean",
    "default": false
  },
  "lkap.excludeLinkPatterns": {
    "type": "array",
    "items": { "type": "string" },
    "default": ["node_modules/**", ".git/**"],
    "scope": "resource"
  },
  "lkap.indexRefreshInterval": {
    "type": "number",
    "default": 5000,
    "scope": "resource"
  }
}
```

---

## Type Safety Checklist

Before implementing each module, verify:

- [ ] All function parameters typed explicitly
- [ ] All return types specified
- [ ] No use of `any` type
- [ ] Nullable values marked with `|null` or `|undefined`
- [ ] Error cases handled (no silent failures)
- [ ] Async operations properly typed with `Promise<T>`
- [ ] Events typed with `vscode.Event<T>`
- [ ] Collections typed specifically (Map, Set, not `any[]`)

---

## Code Review Checklist

Before merging each task:

### Functional Correctness
- [ ] Feature works as specified
- [ ] All test cases pass
- [ ] Edge cases handled
- [ ] Error messages clear

### Code Quality
- [ ] ESLint passes
- [ ] TypeScript strict mode passes
- [ ] No `any` types
- [ ] JSDoc on public functions
- [ ] Variable names clear and consistent

### Performance
- [ ] No obvious inefficiencies
- [ ] Algorithms reasonable complexity
- [ ] No memory leaks (check with large data)
- [ ] Meets performance targets

### Documentation
- [ ] README updated if needed
- [ ] Code comments explain why, not what
- [ ] Usage examples provided
- [ ] Limitations documented

### Testing
- [ ] Unit tests included
- [ ] Coverage 80%+
- [ ] Integration tests passing
- [ ] Manual testing confirmed

---

## Dependency Graph

```
Phase 1:
  types ──┐
          ├─ linkUtils
          │   └─ linkIndexService ──┐
          │                          ├─ extension.ts
          │   linkResolver ──────────┤
          │                          │
          │   backlinksProvider ─────┘

Phase 2:
  extension.ts ──┐
                 ├─ linkNavigation
                 ├─ quickLinkCreate
                 ├─ linkHoverProvider
                 ├─ backlinksView
                 └─ validationCommands

Phase 3:
  All Phase 1 & 2 ──┐
                    ├─ fileWatcher
                    ├─ indexPersistence
                    ├─ linkCompletion
                    ├─ graphVisualization
                    ├─ tagsView
                    └─ advancedSearch
```

---

## Timeline Template

**Week 1:**
- Mon-Tue: Task 1.1 (Types)
- Tue-Wed: Task 1.2 (Parser)
- Wed-Fri: Task 1.3 (Index Service)
- Parallel: Tasks 1.4, 1.5, 1.6

**Week 2:**
- Mon-Tue: Finish Phase 1 tasks
- Tue-Wed: Testing & bug fixes
- Thu-Fri: Phase 1 review & sign-off

**Week 3:**
- Mon-Tue: Task 2.1 (Navigation)
- Tue-Thu: Task 2.2 (Backlinks View)
- Thu-Fri: Tasks 2.3-2.5

**Week 4:**
- Mon-Tue: Testing & bug fixes
- Tue-Wed: Phase 2 polish
- Thu-Fri: Phase 2 review & sign-off

**Weeks 5+:**
- Phase 3 features as prioritized

---

## Quick Start for Developers

1. **Read documentation in order:**
   - Start: ARCHITECTURE_LINKING.md (overview)
   - Then: LINKING_IMPLEMENTATION_TASKS.md (detailed tasks)
   - Ref: This document (quick lookup)

2. **Set up development environment:**
   ```bash
   cd D:\development\lkap
   npm install
   npm run compile
   ```

3. **Understand existing code:**
   - Review `src/extension.ts` (entry point)
   - Review `src/types/index.ts` (type definitions)
   - Review `src/utils/fileUtils.ts` (file operations)

4. **Pick a task from Phase 1:**
   - Start with Task 1.1 (types) - no dependencies
   - Then Task 1.2 (parser) - depends on 1.1
   - Then Task 1.3 (index) - depends on 1.2

5. **For each task:**
   - Read detailed description
   - Create files/modify as specified
   - Write tests
   - Run `npm run compile && npm run lint`
   - Test manually with F5 debug
   - Get code review

6. **Testing locally:**
   ```bash
   npm run compile  # Build
   npm run lint     # Check code
   npm run test     # Run tests
   # Press F5 to debug in new VSCode window
   ```

---

## Resources

**VSCode Extension APIs:**
- https://code.visualstudio.com/api/references/vscode-api
- Tree Data Provider: https://code.visualstudio.com/api/extension-guides/tree-view
- HoverProvider: https://code.visualstudio.com/api/references/vscode-api#HoverProvider

**Related Tools:**
- Obsidian: https://obsidian.md (inspiration for link syntax)
- Roam Research: https://roamresearch.com (inspiration for backlinks)
- VSCode Markdown Support: Built-in markdown language support

**Performance Optimization:**
- Note: Performance goals based on typical SSD (5000+ IOPS)
- Adjust for lower-end hardware if needed
- Consider implementing caching in Phase 3

---

This quick reference complements the detailed architecture and task documents. Use it alongside those docs for efficient implementation and communication.
