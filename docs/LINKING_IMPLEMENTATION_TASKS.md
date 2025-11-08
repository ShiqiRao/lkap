# LKAP Bidirectional Linking - Implementation Task Breakdown

This document provides a detailed, actionable task breakdown for implementing the bidirectional linking feature as outlined in `ARCHITECTURE_LINKING.md`.

---

## PHASE 1: CORE INDEXING & PARSING (Weeks 1-2)

### Task 1.1: Define Link Types (2 hours)

**Status:** Pending
**Assigned to:** Architecture/Core Developer
**Priority:** Critical (blocks all other tasks)

**Subtasks:**

1.1.1 - Extend `src/types/index.ts` with new interfaces
- [ ] Add `LinkInstance` interface (8 properties)
- [ ] Add `FileIndex` interface (6 properties)
- [ ] Add `LinkIndex` interface (5 properties)
- [ ] Add `LinkParseResult` interface (3 properties)
- [ ] Add `LinkConfig` interface (4 properties)
- [ ] Add `BacklinksQuery` interface (3 properties)
- [ ] Add `LinkResolution` interface (4 properties)

**File to Modify:** `D:\development\lkap\src\types\index.ts`

**Exact Changes Required:**
```typescript
// Add after line 72 (after CommandResult interface)

export interface LinkInstance {
  title: string;
  sourceFile: string;
  targetFile: string | null;
  range: vscode.Range;
  format: 'wikilink' | 'markdown';
  targetExists: boolean;
  displayText: string;
}

// ... (continue with other interfaces as per ARCHITECTURE_LINKING.md section 2.1)
```

**Verification:**
- [ ] Code compiles with no TypeScript errors
- [ ] All interfaces properly import/use vscode types
- [ ] Run: `npm run compile` successfully
- [ ] Run: `npm run lint` with no errors

**Acceptance Criteria:**
- All type definitions match specification in ARCHITECTURE_LINKING.md
- TypeScript strict mode: passing
- ESLint: no errors or warnings on new code

---

### Task 1.2: Implement Link Parser Utility (6 hours)

**Status:** Pending
**Assigned to:** Core Developer
**Priority:** Critical (Phase 1 foundation)
**Depends on:** Task 1.1

**Subtasks:**

1.2.1 - Create LinkParser class skeleton
- [ ] Create file `D:\development\lkap\src\utils\linkUtils.ts`
- [ ] Define LinkParser class
- [ ] Define all static methods (signatures only)

1.2.2 - Implement regex pattern functions
- [ ] `extractWikilinks()` - regex: `\[\[([^\]]+)\]\]`
- [ ] `extractMarkdownLinks()` - regex: `\[([^\]]+)\]\(([^)]+)\)`
- [ ] `extractTags()` - regex: `(?:^|\s)#([\w-]+)`
- [ ] Test regexes with markdown test cases (see section below)

1.2.3 - Implement position/range functions
- [ ] `getPositionFromOffset()` - convert string offset to vscode.Position
- [ ] Create vscode.Range from match positions
- [ ] Handle line/character calculations correctly

1.2.4 - Implement text normalization
- [ ] `normalizeLinkTarget()` - convert "My Note" -> "my-note.md"
- [ ] Handle spaces -> hyphens
- [ ] Handle capitalization
- [ ] Add `.md` extension if missing
- [ ] Test with various inputs

1.2.5 - Implement content hashing
- [ ] `hashContent()` - quick hash function for change detection
- [ ] Use Node's crypto or simple hash
- [ ] Verify consistency across calls

1.2.6 - Implement main parsing function
- [ ] `parseLinks()` - orchestrate parsing
- [ ] Call all extract functions
- [ ] Build LinkInstance array
- [ ] Return LinkParseResult with errors

1.2.7 - Add JSDoc comments
- [ ] Document all public methods
- [ ] Include examples in comments
- [ ] Document edge cases

**Test Cases (from ARCHITECTURE_LINKING.md):**

**Test File Content:**
```markdown
# Wiki and Markdown Links

This file has [[simple-link]].

Also has [markdown link](target-note).

With multiple: [[first]] and [second](third) and #tags.

Edge cases:
- \[\[escaped\]\]
- [[empty||display]]
- [no closing bracket
```

**Expected Output for parseLinks():**
```typescript
{
  links: [
    {
      title: "simple-link",
      format: "wikilink",
      // ... other properties
    },
    {
      title: "markdown link",
      format: "markdown",
      // ... other properties
    },
    // ... more links
  ],
  tags: ["tags"],
  errors: [] // or list of parsing issues
}
```

**Verification:**
- [ ] All regex patterns tested with markdown samples
- [ ] Position tracking accurate (matching vscode.Range)
- [ ] Edge cases handled (escaped, empty, malformed)
- [ ] Code compiles without errors
- [ ] `npm run lint` passes

**Acceptance Criteria:**
- Correctly extracts all three link formats
- Position information accurate for all matches
- Edge cases handled gracefully
- Regex patterns match specification exactly
- Performance: <5ms for typical 5KB note

---

### Task 1.3: Implement Link Index Service (8 hours)

**Status:** Pending
**Assigned to:** Core Developer
**Priority:** Critical (core feature)
**Depends on:** Task 1.2

**Subtasks:**

1.3.1 - Create LinkIndexService class
- [ ] Create file `D:\development\lkap\src\services\linkIndexService.ts`
- [ ] Create new directory `D:\development\lkap\src\services\` if needed
- [ ] Extend vscode.Disposable
- [ ] Initialize with ExtensionContext

1.3.2 - Implement index initialization
- [ ] `constructor(context: vscode.ExtensionContext)`
- [ ] Set up EventEmitter for onIndexChanged
- [ ] Initialize empty LinkIndex
- [ ] Set up config getters

1.3.3 - Implement full rebuild
- [ ] `async rebuildIndex(showProgress?: boolean): Promise<LinkIndex>`
- [ ] Get markdown files from notes directory
- [ ] Parse each file with LinkParser
- [ ] Build forward links (files -> LinkInstance[])
- [ ] Build backlinks map (target -> sources[])
- [ ] Build tags map (tag -> files[])
- [ ] Update metadata (timing, counts)
- [ ] Fire onIndexChanged event
- [ ] Optional: Show progress notification

1.3.4 - Implement incremental updates
- [ ] `async updateFile(filePath: string, content: string)`
- [ ] Debounce rapid changes (500ms)
- [ ] Remove old links for file from backlinks
- [ ] Parse new content
- [ ] Update file entry
- [ ] Add new backlinks
- [ ] Fire event

1.3.5 - Implement file removal
- [ ] `async removeFile(filePath: string)`
- [ ] Remove from files map
- [ ] Remove from backlinks (as source)
- [ ] Remove from tags
- [ ] Fire event

1.3.6 - Implement query methods
- [ ] `getIndex(): Readonly<LinkIndex>`
- [ ] `isBuilding(): boolean`
- [ ] `getStats()` - return statistics
- [ ] `get onIndexChanged(): vscode.Event<LinkIndex>`

1.3.7 - Implement lifecycle
- [ ] `dispose(): void`
- [ ] Clean up file watchers (if added in Phase 3)
- [ ] Clean up timers
- [ ] Clean up event emitters

**Internal Implementation Details:**

Required helper methods:
```typescript
private getConfig(): ExtensionConfig
private persistIndex(): Promise<void>  // For Phase 3
private validateIndex(): LinkIndex
```

**Data Structures:**
```typescript
private index: LinkIndex
private isBuilding: boolean = false
private indexChangeEmitter: vscode.EventEmitter<LinkIndex>
private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
```

**Verification:**
- [ ] Build completes successfully (<5 seconds for 100 notes)
- [ ] Index contains all files
- [ ] Backlinks correctly populated
- [ ] Tags correctly extracted
- [ ] Events fire on changes
- [ ] No memory leaks (check with 1000 note test)
- [ ] `npm run lint` passes
- [ ] TypeScript strict mode: no errors

**Performance Tests:**
- [ ] 10 notes: <100ms build time
- [ ] 100 notes: <2 seconds build time
- [ ] Single file update: <100ms
- [ ] Memory usage reasonable (<10MB for 100 notes)

**Acceptance Criteria:**
- Full index rebuild working correctly
- Incremental updates working
- File removal handled
- Event system functional
- Statistics accurate
- Proper resource cleanup
- No errors or warnings

---

### Task 1.4: Implement Link Resolver (4 hours)

**Status:** Pending
**Assigned to:** Core Developer
**Priority:** High
**Depends on:** Task 1.3

**Subtasks:**

1.4.1 - Create LinkResolver class
- [ ] Create file `D:\development\lkap\src\services\linkResolver.ts`
- [ ] Store reference to LinkIndex
- [ ] Implement updateIndex() for index rebuilds

1.4.2 - Implement exact matching
- [ ] Find exact filename match (case-sensitive first)
- [ ] Return LinkResolution with targetFile set

1.4.3 - Implement fuzzy matching
- [ ] If exact not found, try case-insensitive
- [ ] If still not found, implement fuzzy match algorithm:
  - Levenshtein distance or similar
  - Score based on similarity
  - Return best match

1.4.4 - Implement candidate generation
- [ ] `getCandidates(linkTarget: string, limit?: number)`
- [ ] Return top N candidates sorted by relevance
- [ ] Used for autocomplete and disambiguation

1.4.5 - Implement utility methods
- [ ] `isLinked(from: string, to: string): boolean`
- [ ] `getLink(from: string, to: string): LinkInstance | null`

1.4.6 - Add documentation
- [ ] JSDoc for all public methods
- [ ] Document matching strategy
- [ ] Include examples

**Test Cases:**

```typescript
// Test exact match
resolver.resolveLink({title: "my-note", ...}, sourceFile)
// Expected: targetFile = "/path/to/my-note.md"

// Test fuzzy match
resolver.resolveLink({title: "mnote", ...}, sourceFile)
// Expected: targetFile = "/path/to/my-note.md" (fuzzy match)

// Test candidates
resolver.getCandidates("note")
// Expected: ["my-note.md", "notes.md", "note.md"] (top 5)
```

**Verification:**
- [ ] Exact matching accurate
- [ ] Fuzzy matching finds relevant files
- [ ] Candidates in correct order
- [ ] Performance <10ms per resolution
- [ ] Handles edge cases (empty target, special chars)
- [ ] Code compiles and lints

**Acceptance Criteria:**
- Resolves links correctly
- Finds candidates for autocomplete
- Handles edge cases
- Performance acceptable
- Type-safe implementation

---

### Task 1.5: Implement Backlinks Provider (4 hours)

**Status:** Pending
**Assigned to:** Core Developer
**Priority:** High
**Depends on:** Task 1.3

**Subtasks:**

1.5.1 - Create BacklinksProvider class
- [ ] Create file `D:\development\lkap\src\services\backlinksProvider.ts`
- [ ] Store reference to LinkIndex
- [ ] Implement updateIndex() for index rebuilds

1.5.2 - Implement backlinks query
- [ ] `getBacklinksFor(filePath: string): FileIndex[]`
- [ ] Lookup in backlinks map
- [ ] Return FileIndex for each source
- [ ] Test accuracy

1.5.3 - Implement forward links query
- [ ] `getLinksFrom(filePath: string): LinkInstance[]`
- [ ] Get FileIndex for file
- [ ] Return outgoingLinks array
- [ ] Verify all LinkInstances populated

1.5.4 - Implement graph distance
- [ ] `getDistance(from: string, to: string): number`
- [ ] BFS to find shortest path
- [ ] Return distance or -1 if not connected
- [ ] Cache results for performance

1.5.5 - Implement graph traversal
- [ ] `getConnectedGraph(file: string, maxDepth?: number)`
- [ ] DFS/BFS to find all connected files
- [ ] Return Map<filepath, distance>
- [ ] Respect maxDepth parameter

1.5.6 - Implement validation
- [ ] `getFilesWithBrokenLinks(): FileIndex[]`
- [ ] Find all links with targetFile == null
- [ ] Return files containing broken links
- [ ] Include link details

1.5.7 - Implement full validation report
- [ ] `validateLinks(): { valid, broken, details }`
- [ ] Count valid and broken links
- [ ] Return details for each broken link
- [ ] Used for "Validate Links" command

**Test Cases:**

```typescript
// File A links to B, B links to C
// A -> B -> C

backlinks.getBacklinksFor(B)
// Expected: [A] (files linking to B)

backlinks.getDistance(A, C)
// Expected: 2 (A -> B -> C)

backlinks.getConnectedGraph(A, 2)
// Expected: Map { B: 1, C: 2 }
```

**Verification:**
- [ ] Backlinks queries accurate
- [ ] Graph traversal finds all connections
- [ ] Distance calculations correct
- [ ] Validation detects broken links
- [ ] Performance acceptable
- [ ] Code compiles and lints

**Acceptance Criteria:**
- All query methods working correctly
- Graph operations accurate
- Validation reports comprehensive
- Performance within limits
- No memory leaks on large graphs

---

### Task 1.6: Create Unit Tests (6 hours)

**Status:** Pending
**Assigned to:** QA/Test Developer
**Priority:** High
**Depends on:** Tasks 1.2-1.5

**Subtasks:**

1.6.1 - Create test directory structure
- [ ] Create `D:\development\lkap\src\__tests__\` directory
- [ ] Create `linkParser.test.ts`
- [ ] Create `linkIndexService.test.ts`
- [ ] Create `linkResolver.test.ts`
- [ ] Create `backlinksProvider.test.ts`

1.6.2 - Test link parsing
- [ ] Test wiki-style links: `[[note]]`
- [ ] Test markdown links: `[text](note)`
- [ ] Test tags: `#tag`
- [ ] Test mixed content
- [ ] Test edge cases:
  - Escaped brackets
  - Empty links
  - Malformed links
  - Links at various positions
  - Multiple links per line
- [ ] Test position accuracy (vscode.Range)

1.6.3 - Test index building
- [ ] Test full rebuild with sample files
- [ ] Test incremental update
- [ ] Test file removal
- [ ] Test backlinks map accuracy
- [ ] Test tags map accuracy
- [ ] Test event emission

1.6.4 - Test link resolution
- [ ] Test exact match
- [ ] Test case-insensitive match
- [ ] Test fuzzy match
- [ ] Test candidate generation
- [ ] Test with missing files
- [ ] Test with multiple candidates

1.6.5 - Test backlinks queries
- [ ] Test getBacklinksFor()
- [ ] Test getLinksFrom()
- [ ] Test getDistance()
- [ ] Test getConnectedGraph()
- [ ] Test validateLinks()

1.6.6 - Add performance benchmarks
- [ ] Measure build time for various sizes
- [ ] Measure resolution time
- [ ] Measure query times
- [ ] Document baselines

**Test Framework:**
- Use Jest (if available) or Mocha
- Mock vscode APIs
- Use test fixtures (sample markdown files)

**Sample Test Structure:**
```typescript
describe('LinkParser', () => {
  describe('extractWikilinks', () => {
    it('should extract simple wiki-style link', () => {
      const content = 'This is a [[simple-link]]';
      const result = LinkParser.parseLinks(content, '/path/to/file.md');
      expect(result.links).toHaveLength(1);
      expect(result.links[0].title).toBe('simple-link');
    });
    // ... more test cases
  });
});
```

**Verification:**
- [ ] All test files created and compilable
- [ ] 80%+ code coverage
- [ ] All edge cases covered
- [ ] Tests pass consistently
- [ ] Performance baselines documented

**Acceptance Criteria:**
- Comprehensive test coverage (80%+)
- All regex patterns tested
- Edge cases covered
- Performance benchmarks established
- CI/CD integration ready

---

### Task 1.7: Update Extension Registration (2 hours)

**Status:** Pending
**Assigned to:** Core Developer
**Priority:** High
**Depends on:** Tasks 1.3, 1.4, 1.5

**Subtasks:**

1.7.1 - Modify `src/extension.ts`
- [ ] Import LinkIndexService
- [ ] Import LinkResolver
- [ ] Import BacklinksProvider
- [ ] Create instances in activate()

1.7.2 - Initialize services
```typescript
const linkIndexService = new LinkIndexService(context);
const linkResolver = new LinkResolver(linkIndexService.getIndex());
const backlinksProvider = new BacklinksProvider(linkIndexService.getIndex());

context.subscriptions.push(linkIndexService);
```

1.7.3 - Build initial index
- [ ] Call `linkIndexService.rebuildIndex(true)` on activation
- [ ] Show progress notification
- [ ] Handle errors gracefully

1.7.4 - Set up event listeners
- [ ] Subscribe to config changes
- [ ] Rebuild index on relevant config changes
- [ ] Update resolver/provider indexes
- [ ] Handle errors

1.7.5 - Add cleanup
- [ ] Ensure proper disposal in deactivate()
- [ ] All services disposed
- [ ] All subscriptions cleaned up

**Code Changes Required:**
- Update: `D:\development\lkap\src\extension.ts`

**Verification:**
- [ ] Extension activates without errors
- [ ] Index builds on activation
- [ ] Config changes trigger rebuild
- [ ] No memory leaks
- [ ] Services properly disposed
- [ ] `npm run compile` succeeds
- [ ] `npm run test` passes

**Acceptance Criteria:**
- Extension starts without errors
- Index available immediately after activation
- Configuration changes handled
- Proper resource cleanup
- No console errors or warnings

---

### Phase 1 Summary Checklist

**Code Files to Create:**
- [ ] `D:\development\lkap\src\utils\linkUtils.ts`
- [ ] `D:\development\lkap\src\services\linkIndexService.ts`
- [ ] `D:\development\lkap\src\services\linkResolver.ts`
- [ ] `D:\development\lkap\src\services\backlinksProvider.ts`
- [ ] `D:\development\lkap\src\__tests__\linkParser.test.ts`
- [ ] `D:\development\lkap\src\__tests__\linkIndexService.test.ts`
- [ ] `D:\development\lkap\src\__tests__\linkResolver.test.ts`
- [ ] `D:\development\lkap\src\__tests__\backlinksProvider.test.ts`

**Files to Modify:**
- [ ] `D:\development\lkap\src\types\index.ts` - Add type definitions
- [ ] `D:\development\lkap\src\extension.ts` - Register services

**Build & Verification:**
- [ ] `npm run compile` - No errors
- [ ] `npm run lint` - No errors
- [ ] `npm run test` - All tests passing
- [ ] Manual testing - Index builds correctly

**Quality Gates:**
- [ ] TypeScript strict mode: passing
- [ ] ESLint: no errors
- [ ] Test coverage: 80%+
- [ ] No console errors on activation

---

## PHASE 2: LINK NAVIGATION & UI (Weeks 3-4)

### Task 2.1: Implement Link Navigation Command (4 hours)

**Status:** Pending
**Assigned to:** Core Developer
**Priority:** High
**Depends on:** Phase 1 completion

**Subtasks:**

2.1.1 - Create link navigation command handler
- [ ] Create file `D:\development\lkap\src\commands\linkNavigation.ts`
- [ ] Implement `registerLinkNavigationCommands()`
- [ ] Register command `lkap.goToLink`

2.1.2 - Implement link detection
- [ ] Helper function: `findLinkAtPosition(document, position)`
- [ ] Check if position is within link syntax
- [ ] Extract link text and range
- [ ] Handle both wikilink and markdown formats

2.1.3 - Implement link resolution
- [ ] Get editor's current file
- [ ] Find link at cursor
- [ ] Use LinkResolver to find target
- [ ] Handle resolution failures

2.1.4 - Implement file opening
- [ ] Open target file if exists
- [ ] Show error if not found
- [ ] Optionally show candidates
- [ ] Optionally offer to create

2.1.5 - Add keybinding
- [ ] Add to package.json: keybinding for command
- [ ] Consider: Ctrl+Click or custom key
- [ ] Test keybinding works

2.1.6 - Add to editor context menu
- [ ] Show "Go to Link" in right-click menu
- [ ] Available only when on a link
- [ ] Include icon

**File Modifications:**
- Create: `D:\development\lkap\src\commands\linkNavigation.ts`
- Modify: `D:\development\lkap\src\extension.ts` - Import and register
- Modify: `D:\development\lkap\package.json` - Add command and keybinding

**package.json Addition:**
```json
{
  "command": "lkap.goToLink",
  "title": "Go to Linked Note",
  "category": "LKAP",
  "icon": "$(link-external)"
}
```

**Verification:**
- [ ] Command appears in command palette
- [ ] Keybinding works
- [ ] Opens correct file when on link
- [ ] Shows error when target missing
- [ ] Handles edge cases
- [ ] Code compiles and lints

**Acceptance Criteria:**
- Navigation working for both link formats
- Smooth user experience
- Error handling appropriate
- Performance acceptable
- No console errors

---

### Task 2.2: Create Backlinks View Provider (6 hours)

**Status:** Pending
**Assigned to:** UI Developer
**Priority:** High
**Depends on:** Phase 1 completion

**Subtasks:**

2.2.1 - Create backlinks tree data provider
- [ ] Create file `D:\development\lkap\src\views\backlinksView.ts`
- [ ] Implement vscode.TreeDataProvider<BacklinkItem>
- [ ] Define BacklinkItem interface

2.2.2 - Implement tree item methods
- [ ] `getTreeItem()` - Create TreeItem from BacklinkItem
- [ ] `getChildren()` - Get backlinks for current file
- [ ] Handle no backlinks case
- [ ] Add icons for visual feedback

2.2.3 - Implement event listeners
- [ ] Subscribe to onIndexChanged
- [ ] Subscribe to onDidChangeActiveTextEditor
- [ ] Refresh tree on changes
- [ ] Use debounce if needed

2.2.4 - Implement click handler
- [ ] Each tree item clickable
- [ ] Opens linked file on click
- [ ] Command: vscode.open

2.2.5 - Add configuration options
- [ ] Setting to show/hide view
- [ ] Setting for grouping (Direct/Indirect)
- [ ] Setting for sort order

2.2.6 - Add UI enhancements
- [ ] Show count of backlinks
- [ ] Show icons for file type
- [ ] Show breadcrumb/path

**File Modifications:**
- Create: `D:\development\lkap\src\views\backlinksView.ts`
- Modify: `D:\development\lkap\src\extension.ts` - Register provider
- No package.json changes (view already in manifest)

**Helper Interface:**
```typescript
interface BacklinkItem {
  label: string;
  filePath: string;
  count?: number;
  collapsibleState: vscode.TreeItemCollapsibleState;
}
```

**Verification:**
- [ ] View appears in explorer sidebar
- [ ] Shows backlinks for current file
- [ ] Updates when switching files
- [ ] Updates when index changes
- [ ] Clicking opens file
- [ ] Shows correct count
- [ ] Code compiles and lints

**Acceptance Criteria:**
- View functional and responsive
- Real-time updates working
- UI polished
- Performance acceptable
- No memory leaks on rapid switches

---

### Task 2.3: Create Quick Link Create Command (4 hours)

**Status:** Pending
**Assigned to:** Core Developer
**Priority:** Medium
**Depends on:** Phase 1 completion

**Subtasks:**

2.3.1 - Create command handler
- [ ] Create file `D:\development\lkap\src\commands\quickLinkCreate.ts`
- [ ] Implement `registerQuickLinkCreateCommand()`
- [ ] Register command `lkap.createFromLink`

2.3.2 - Detect unresolved links
- [ ] Find link at cursor
- [ ] Check if target exists
- [ ] Only proceed if missing

2.3.3 - Prompt user
- [ ] Show input box for note name
- [ ] Pre-fill with link text
- [ ] Allow user to confirm/cancel

2.3.4 - Create new note
- [ ] Create file with given name
- [ ] Place in notes directory
- [ ] Apply template if configured
- [ ] Open newly created file
- [ ] Index immediately

2.3.5 - Update source link
- [ ] Optionally auto-create link
- [ ] User confirms location
- [ ] File linked and indexed

**File Modifications:**
- Create: `D:\development\lkap\src\commands\quickLinkCreate.ts`
- Modify: `D:\development\lkap\src\extension.ts` - Import and register

**package.json Addition:**
```json
{
  "command": "lkap.createFromLink",
  "title": "Create Note from Link",
  "category": "LKAP"
}
```

**Verification:**
- [ ] Command works when cursor on link
- [ ] Creates file with correct name
- [ ] File appears in index
- [ ] Backlinks updated correctly
- [ ] Error handling appropriate

**Acceptance Criteria:**
- Quick workflow for creating linked notes
- Smooth integration with editor
- Proper error handling
- User feedback appropriate

---

### Task 2.4: Add Link Hover Provider (3 hours)

**Status:** Pending
**Assigned to:** UI Developer
**Priority:** Medium
**Depends on:** Phase 1 completion

**Subtasks:**

2.4.1 - Create hover provider
- [ ] Create class implementing vscode.HoverProvider
- [ ] Add to `src/views/backlinksView.ts` or separate file

2.4.2 - Implement hover logic
- [ ] Detect when hovering over link
- [ ] Resolve link target
- [ ] Show link information
- [ ] Show status (exists/missing)

2.4.3 - Format hover content
- [ ] Show target file name
- [ ] Show if target exists
- [ ] Show candidates if missing
- [ ] Include first few lines of preview

2.4.4 - Register provider
- [ ] Register with vscode.languages.registerHoverProvider
- [ ] For markdown language
- [ ] In extension.ts activate()

**Code Structure:**
```typescript
export class LinkHoverProvider implements vscode.HoverProvider {
  constructor(
    private linkResolver: LinkResolver,
    private backlinksProvider: BacklinksProvider
  ) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | null {
    // Implementation
  }
}
```

**Verification:**
- [ ] Hover shows on links
- [ ] Content accurate and formatted
- [ ] Shows status and candidates
- [ ] No performance issues
- [ ] Works for both link formats

**Acceptance Criteria:**
- Hover provider working
- Information useful and accurate
- Performance acceptable
- No console errors

---

### Task 2.5: Add Validation Commands (2 hours)

**Status:** Pending
**Assigned to:** Core Developer
**Priority:** Low
**Depends on:** Phase 1 completion

**Subtasks:**

2.5.1 - Add validate links command
- [ ] Register `lkap.validateLinks`
- [ ] Run validation report
- [ ] Show results to user
- [ ] List broken links

2.5.2 - Add rebuild index command
- [ ] Register `lkap.rebuildIndex`
- [ ] Force full index rebuild
- [ ] Show progress
- [ ] Show completion message

2.5.3 - Add update package.json
- [ ] Add commands to contributes.commands

**File Modifications:**
- Create: `D:\development\lkap\src\commands\validationCommands.ts` (optional)
- Modify: `D:\development\lkap\src\extension.ts` - Register commands
- Modify: `D:\development\lkap\package.json` - Add commands

**Verification:**
- [ ] Commands appear in palette
- [ ] Work as expected
- [ ] Show appropriate feedback
- [ ] Handle errors gracefully

**Acceptance Criteria:**
- Commands functional
- User feedback clear
- Error handling appropriate

---

### Phase 2 Summary Checklist

**Code Files to Create:**
- [ ] `D:\development\lkap\src\commands\linkNavigation.ts`
- [ ] `D:\development\lkap\src\commands\quickLinkCreate.ts`
- [ ] `D:\development\lkap\src\commands\validationCommands.ts` (optional)
- [ ] `D:\development\lkap\src\views\backlinksView.ts`

**Files to Modify:**
- [ ] `D:\development\lkap\src\extension.ts` - Import and register new items
- [ ] `D:\development\lkap\package.json` - Add commands and keybindings

**Build & Verification:**
- [ ] `npm run compile` - No errors
- [ ] `npm run lint` - No errors
- [ ] Manual testing - All features working
- [ ] F5 debugging - No console errors

**Quality Gates:**
- [ ] TypeScript strict mode: passing
- [ ] ESLint: no errors
- [ ] User-facing features polished
- [ ] Error messages helpful

---

## PHASE 3: ADVANCED FEATURES (Weeks 5+)

### Task 3.1: File Watcher Implementation (6 hours)

Extend `LinkIndexService` to watch for file changes.

**Key Subtasks:**
- [ ] Set up FileSystemWatcher
- [ ] Debounce rapid changes
- [ ] Incremental index updates
- [ ] Handle file creation/deletion/modification

---

### Task 3.2: Index Persistence (4 hours)

Save/load index from disk.

**Key Subtasks:**
- [ ] Create `.lkap` directory
- [ ] Serialize index to JSON
- [ ] Load on startup
- [ ] Invalidate on config changes

---

### Task 3.3: Link Auto-completion (6 hours)

Suggest notes while typing.

**Key Subtasks:**
- [ ] Detect trigger characters `[[` and `[`
- [ ] Get candidates from LinkResolver
- [ ] Show completion menu
- [ ] Filter as user types

---

### Task 3.4: Graph Visualization (10 hours)

WebView showing note connections.

**Key Subtasks:**
- [ ] Create WebView panel
- [ ] Render force-directed graph
- [ ] Interactive navigation
- [ ] Filter by tags

---

### Task 3.5: Tag Tree View (6 hours)

Extend tags view with filtering.

**Key Subtasks:**
- [ ] Tree of all tags
- [ ] Click to filter
- [ ] Show usage count

---

### Task 3.6: Advanced Search (6 hours)

Search by tag, link type, date.

**Key Subtasks:**
- [ ] Search index implementation
- [ ] Filter interfaces
- [ ] UI for search

---

## TASK DEPENDENCIES & SCHEDULING

### Critical Path (Sequential)
1. Task 1.1: Type Definitions (2h)
2. Task 1.2: Link Parser (6h)
3. Task 1.3: Index Service (8h)
4. Task 1.7: Extension Registration (2h)
- **Subtotal: 18 hours** (end of Week 1)

### Parallel Tasks (after 1.1)
- Task 1.4: Link Resolver (4h)
- Task 1.5: Backlinks Provider (4h)
- Task 1.6: Unit Tests (6h)
- **Subtotal: 14 hours** (Week 1-2 in parallel)

### Phase 1 Total: ~35 hours (2 weeks)

### Phase 2 (start after Phase 1)
- Task 2.1: Link Navigation (4h)
- Task 2.2: Backlinks View (6h)
- Task 2.3: Quick Create (4h)
- Task 2.4: Hover Provider (3h)
- Task 2.5: Validation Commands (2h)
- **Subtotal: 19 hours** (Weeks 3-4)

### Phase 3 (start after Phase 2)
- Various advanced features
- **Estimated: 45+ hours** (Weeks 5+)

---

## TESTING CHECKLIST

### Unit Tests
- [ ] LinkParser: all regex patterns
- [ ] LinkIndexService: build/update/remove
- [ ] LinkResolver: matching strategies
- [ ] BacklinksProvider: queries
- [ ] Coverage: 80%+

### Integration Tests
- [ ] Parse -> Index -> Resolve workflow
- [ ] Config changes trigger rebuilds
- [ ] File operations reflected in index
- [ ] Events propagated correctly

### Manual Testing
- [ ] Create note with links
- [ ] Navigate to linked note
- [ ] View backlinks in sidebar
- [ ] Hover shows link info
- [ ] Validation finds broken links
- [ ] Performance acceptable

### Performance Benchmarks
- [ ] Build time: 100 notes < 2 seconds
- [ ] Link resolution: < 10ms
- [ ] Backlinks query: < 5ms
- [ ] Memory usage: < 100MB for 1000 notes

---

## ROLLBACK POINTS

Each phase can be independently disabled:

**Phase 1 Issues:**
```typescript
// In extension.ts, around line 17:
// Comment out: vscode.commands.executeCommand('setContext', 'lkap.enabled', true);
// This hides all linking UI
```

**Phase 2 Issues:**
```typescript
// Disable specific commands in package.json
// Unregister providers in extension.ts
```

**Phase 3 Issues:**
```typescript
// Disable watchers
// Disable persistence
// Disable new UI elements
```

---

## COMPLETION CRITERIA

**Phase 1 Complete When:**
- [ ] All 7 tasks completed
- [ ] 80%+ test coverage
- [ ] `npm run compile && npm run lint && npm run test` all pass
- [ ] No console errors on activation
- [ ] Index builds correctly for test workspace

**Phase 2 Complete When:**
- [ ] All 5 tasks completed
- [ ] User can navigate links
- [ ] Backlinks view functional and updated
- [ ] All features polished
- [ ] Manual testing passes

**Phase 3 Complete When:**
- [ ] File watcher working
- [ ] Index persistence working
- [ ] Auto-completion working
- [ ] Graph visualization working
- [ ] Performance optimized

---

## COMMUNICATION & HANDOFF

Each completed task should include:
1. Code review checklist
2. Test results
3. Performance metrics
4. Known issues
5. Notes for next task
6. Git commit with clear message

Example commit message:
```
feat(linking): implement link parser utility

- Implement wiki-style link extraction ([[note]])
- Implement markdown link extraction ([text](note))
- Implement tag extraction (#tag)
- Add position tracking for vscode.Range
- Add comprehensive unit tests
- Add JSDoc documentation

Performance: <5ms for 5KB file
Coverage: 85%
```

---

This task breakdown provides everything needed to implement bidirectional linking efficiently and systematically.
