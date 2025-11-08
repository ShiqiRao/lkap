# Bidirectional Linking - Visual Architecture Summary

Quick visual reference of the complete architecture.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    VSCode Extension API                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Commands    │  │  Tree Views  │  │  Hover/Completion│  │
│  │              │  │              │  │  Providers       │  │
│  │ - goToLink   │  │ - Backlinks  │  │                  │  │
│  │ - createFrom │  │ - Tags       │  │ (Phase 2-3)      │  │
│  │   Link       │  │ - Graph      │  │                  │  │
│  │              │  │   (Phase 3)  │  │                  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                   │             │
│         └─────────────────┼───────────────────┘             │
│                           │                                 │
│                    ┌──────▼──────────────────┐              │
│                    │                         │              │
│                    │   LKAP Services         │              │
│                    │  (Phase 1: Core)        │              │
│                    │                         │              │
│                    └──────┬──────────────────┘              │
│                           │                                 │
│         ┌─────────────────┼─────────────────┐              │
│         │                 │                 │              │
│    ┌────▼─────┐  ┌────────▼────────┐  ┌───▼────────┐      │
│    │LinkIndex │  │  LinkResolver   │  │BacklinksPtr│      │
│    │ Service  │  │                 │  │            │      │
│    │          │  │- Exact match    │  │- getBackl. │      │
│    │-rebuild  │  │- Fuzzy match    │  │- getLinks  │      │
│    │-update   │  │- Candidates     │  │- getGraph  │      │
│    │-getIndex │  │                 │  │- validate  │      │
│    └────┬─────┘  └────────┬────────┘  └───▲────────┘      │
│         │                 │                │               │
│         └─────────────────┼────────────────┘               │
│                           │                                │
│                    ┌──────▼──────────────────┐             │
│                    │                         │             │
│                    │   LinkParser            │             │
│                    │  (Phase 1: Core)        │             │
│                    │                         │             │
│                    │- extractWikilinks       │             │
│                    │- extractMarkdownLinks   │             │
│                    │- extractTags            │             │
│                    │- normalizeLinkTarget    │             │
│                    │- getPositionFromOffset  │             │
│                    │- hashContent            │             │
│                    │                         │             │
│                    └──────┬──────────────────┘             │
│                           │                                │
│         ┌─────────────────┼─────────────────┐             │
│         │                 │                 │             │
│    ┌────▼─────┐  ┌────────▼────────┐  ┌───▼──────┐       │
│    │ FileUtils│  │  DateUtils      │  │Workspace │       │
│    │ (Existing)  │  (Existing)      │  │Config    │       │
│    │          │  │                 │  │(Existing)│       │
│    └──────────┘  └─────────────────┘  └──────────┘       │
│                                                             │
│                      ▲                                      │
│                      │                                      │
│                ┌─────┴──────┐                              │
│                │ Markdown   │                              │
│                │ Files      │                              │
│                │ in notes/  │                              │
│                │ directory  │                              │
│                └────────────┘                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
┌─────────────────┐
│ Markdown File   │
│ [[my-note]]     │
│ [text](target)  │
│ #tag            │
└────────┬────────┘
         │
         ▼
    ┌─────────────────────────────┐
    │ LinkParser.parseLinks()     │
    │                             │
    │ - Extract [[wiki]] links    │
    │ - Extract [md](links)       │
    │ - Extract #tags             │
    │ - Calculate positions       │
    └────┬────────────────────────┘
         │
         ▼
    ┌─────────────────────────────┐
    │ LinkParseResult             │
    │                             │
    │ links: LinkInstance[]       │
    │ tags: string[]              │
    │ errors: string[]            │
    └────┬────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────┐
    │ LinkIndexService.rebuildIndex()     │
    │                                     │
    │ 1. Get all markdown files           │
    │ 2. Parse each file                  │
    │ 3. Build files map                  │
    │ 4. Build backlinks map              │
    │ 5. Build tags map                   │
    │ 6. Fire onIndexChanged event        │
    └────┬────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────┐
    │ LinkIndex                            │
    │                                      │
    │ files:                               │
    │   /path/file.md -> FileIndex {       │
    │     outgoingLinks: [LinkInstance]    │
    │   }                                  │
    │                                      │
    │ backlinks:                           │
    │   /path/target.md -> Set [sources]   │
    │                                      │
    │ tags:                                │
    │   "tag" -> Set [files]               │
    └────┬────────────────────────┬────────┘
         │                        │
         ▼                        ▼
    ┌─────────────────┐  ┌──────────────────┐
    │ LinkResolver    │  │ BacklinksProvider│
    │                 │  │                  │
    │ resolveLink()   │  │ getBacklinksFor()│
    │ getCandidates() │  │ getLinksFrom()   │
    │                 │  │ getDistance()    │
    └────┬────────────┘  └────┬─────────────┘
         │                    │
         ├────────┬───────────┘
         │        │
         ▼        ▼
    ┌──────────────────────────────────┐
    │ User-Facing Features (Phase 2)   │
    │                                  │
    │ - goToLink (command)             │
    │ - Backlinks View (sidebar)       │
    │ - Link Hover (preview)           │
    │ - Quick Link Create (command)    │
    │ - Validate Links (command)       │
    └──────────────────────────────────┘
```

---

## Module Dependency Graph

```
Phase 1 (Core - Required)
═══════════════════════════

    ┌──────────────┐
    │ types/index  │
    │ (Interfaces) │
    └──────┬───────┘
           │ (defines)
    ┌──────▼──────────────────────────┐
    │ utils/linkUtils                  │
    │ (LinkParser class)               │
    └──────┬───────────────────────────┘
           │ (uses types)
           │
    ┌──────▼──────────────────────────┐
    │ services/linkIndexService        │
    │ (Manages index, notifies changes)│
    └──────┬───────────────────────────┘
           │ (builds index)
           │
      ┌────┴────┬────────────────┐
      │          │                │
      ▼          ▼                ▼
    ┌──────────────────────────────────┐
    │ services/linkResolver            │
    │ (Resolves links to targets)      │
    └──────────────────────────────────┘

    ┌──────────────────────────────────┐
    │ services/backlinksProvider       │
    │ (Queries backlinks & graph)      │
    └──────────────────────────────────┘

    ┌──────────────────────────────────┐
    │ extension.ts                     │
    │ (Activates all services)         │
    └──────────────────────────────────┘


Phase 2 (UI & Commands - Builds on Phase 1)
═════════════════════════════════════════════

    services/* (Phase 1)
           │
      ┌────┼────┬────────────────┐
      │    │    │                │
      ▼    ▼    ▼                ▼
    ┌─────────────────────────────────────────┐
    │ commands/linkNavigation                 │
    │ commands/quickLinkCreate                │
    │ views/backlinksView                     │
    │ views/linkHoverProvider                 │
    │ commands/validationCommands             │
    └─────────────────────────────────────────┘
           │ (all subscribe to index changes)
           │
    ┌──────▼──────────────────────────────────┐
    │ extension.ts (updated)                  │
    │ (Registers all commands & views)        │
    └─────────────────────────────────────────┘


Phase 3 (Advanced Features - Builds on Phase 1-2)
═════════════════════════════════════════════════

    services/* & views/* (Phase 1-2)
           │
      ┌────┼────┬────────────┬──────────┐
      │    │    │            │          │
      ▼    ▼    ▼            ▼          ▼
    ┌──────────────────────────────────────┐
    │ services/filWatcher                  │
    │ services/indexPersistence            │
    │ providers/linkCompletionProvider     │
    │ views/graphView                      │
    │ views/tagsView (extended)            │
    │ providers/advancedSearch             │
    └──────────────────────────────────────┘
           │ (enhance existing services)
           │
    ┌──────▼──────────────────────────────┐
    │ extension.ts (final)                │
    │ (Full feature set)                  │
    └─────────────────────────────────────┘
```

---

## Phase-by-Phase Rollout

```
PHASE 1: CORE INDEXING & PARSING (Weeks 1-2)
═════════════════════════════════════════════

Deliverables:
  ✓ Link parsing from markdown files
  ✓ Complete index of all links
  ✓ Backlinks mapping
  ✓ Link resolution (exact & fuzzy match)
  ✓ Tag extraction and indexing
  ✓ Real-time index updates
  ✓ Unit tests (80%+ coverage)

User Perception:
  - Index building happens transparently
  - No new UI yet, but foundation complete
  - Extension works as before


PHASE 2: LINK NAVIGATION & UI (Weeks 3-4)
══════════════════════════════════════════

Deliverables:
  ✓ "Go to Link" command (Ctrl+Click)
  ✓ Backlinks sidebar view (real-time)
  ✓ "Create note from link" quick action
  ✓ Link hover preview
  ✓ "Validate links" command
  ✓ "Rebuild index" command

User Perception:
  - Can click links to navigate
  - See what links to current note
  - Quick workflow for creating linked notes
  - Preview on hover
  - Validation of link health


PHASE 3: ADVANCED FEATURES (Weeks 5+)
══════════════════════════════════════

Deliverables:
  ✓ File watcher for incremental updates
  ✓ Index persistence (.lkap/index.json)
  ✓ Link auto-completion ([[type to complete]])
  ✓ Graph visualization
  ✓ Tags tree view with filtering
  ✓ Advanced search

User Perception:
  - Professional-grade note-taking experience
  - Visual graph of connections
  - Intelligent link suggestions
  - Fast startup (cached index)
  - Comprehensive filtering
  - Scales to 1000s of notes


OPTIONAL: POLISH & PERFORMANCE (Week 6+)
════════════════════════════════════════

  - Performance optimizations
  - UI polish and refinement
  - Additional filters and views
  - Export/import features
  - Integration with other features
```

---

## File Structure After Implementation

```
lkap/
├── src/
│   ├── extension.ts                      # MODIFIED
│   ├── types/
│   │   └── index.ts                      # MODIFIED (add interfaces)
│   ├── commands/
│   │   ├── dailyNote.ts                  # UNCHANGED
│   │   ├── linkNavigation.ts             # NEW (Phase 2)
│   │   ├── quickLinkCreate.ts            # NEW (Phase 2)
│   │   └── validationCommands.ts         # NEW (Phase 2)
│   ├── utils/
│   │   ├── fileUtils.ts                  # UNCHANGED
│   │   ├── dateUtils.ts                  # UNCHANGED
│   │   └── linkUtils.ts                  # NEW (Phase 1)
│   ├── services/                         # NEW DIRECTORY (Phase 1-3)
│   │   ├── linkIndexService.ts           # NEW (Phase 1)
│   │   ├── linkResolver.ts               # NEW (Phase 1)
│   │   ├── backlinksProvider.ts          # NEW (Phase 1)
│   │   ├── fileWatcher.ts                # NEW (Phase 3)
│   │   ├── indexPersistence.ts           # NEW (Phase 3)
│   │   └── advancedSearch.ts             # NEW (Phase 3)
│   ├── views/                            # NEW DIRECTORY (Phase 2-3)
│   │   ├── backlinksView.ts              # NEW (Phase 2)
│   │   ├── linkHoverProvider.ts          # NEW (Phase 2)
│   │   ├── graphView.ts                  # NEW (Phase 3)
│   │   ├── tagsView.ts                   # NEW (Phase 3)
│   │   └── linkCompletionProvider.ts     # NEW (Phase 3)
│   └── __tests__/                        # NEW DIRECTORY (Phase 1)
│       ├── linkParser.test.ts            # NEW (Phase 1)
│       ├── linkIndexService.test.ts      # NEW (Phase 1)
│       ├── linkResolver.test.ts          # NEW (Phase 1)
│       └── backlinksProvider.test.ts     # NEW (Phase 1)
│
├── out/                                  # Compiled output (unchanged)
│
├── .lkap/                                # NEW (Phase 3) - Index cache
│   └── index.json                        # NEW (Phase 3)
│
├── ARCHITECTURE_LINKING.md               # NEW - Complete architecture
├── LINKING_IMPLEMENTATION_TASKS.md       # NEW - Detailed task breakdown
├── LINKING_QUICK_REFERENCE.md            # NEW - Quick reference
│
├── package.json                          # MODIFIED (add configs)
├── tsconfig.json                         # UNCHANGED
├── eslintrc.json                         # UNCHANGED
└── ... (other files unchanged)
```

---

## Type Hierarchy

```
LinkInstance (represents a single link)
├── title: string
├── sourceFile: string
├── targetFile: string | null
├── range: vscode.Range
├── format: 'wikilink' | 'markdown'
├── targetExists: boolean
└── displayText: string

FileIndex (represents a file's link metadata)
├── path: string
├── name: string
├── lastIndexed: number
├── contentHash: string
├── outgoingLinks: LinkInstance[]
└── metadata: {
    title?: string
    createdAt?: number
    modifiedAt?: number
    size: number
  }

LinkIndex (complete index of all files/links)
├── files: Map<string, FileIndex>
├── backlinks: Map<string, Set<string>>
├── tags: Map<string, Set<string>>
└── metadata: {
    version: '1.0'
    lastBuildTime: number
    totalFiles: number
    totalLinks: number
  }

LinkParseResult (result of parsing a file)
├── links: LinkInstance[]
├── tags: string[]
└── errors: string[]

LinkResolution (result of resolving a link)
├── link: LinkInstance
├── targetFile: string | null
├── exists: boolean
└── candidates?: FileIndex[]

BacklinksQuery (result of backlinks query)
├── file: string
├── backlinks: FileIndex[]
└── count: number
```

---

## Performance Characteristics

```
Operation                  Time      Space       Notes
─────────────────────────────────────────────────────────
Parse single file          <5ms      O(m)        m=links in file
Index 100 files            <2s       O(n*m)      n=files, m=avg links
Index 1000 files           <20s      O(n*m)
─────────────────────────────────────────────────────────
Resolve single link        <1ms      O(1)        exact match
Find candidates (top 5)    <20ms     O(n log n)  fuzzy match
─────────────────────────────────────────────────────────
Get backlinks              <1ms      O(1)        map lookup
Get forward links          <1ms      O(1)        array access
Graph distance             <10ms     O(n)        BFS
Get connected graph        <50ms     O(n+e)      DFS/BFS
─────────────────────────────────────────────────────────
Validate all links         <100ms    O(n*m)      full scan
─────────────────────────────────────────────────────────

Space Usage:
  100 notes:   5-10MB
  1000 notes:  50-100MB

(Assumes avg 5KB/note, 3 links/note, 2 tags/note)
```

---

## Feature Matrix

```
                          Phase 1  Phase 2  Phase 3
────────────────────────────────────────────────
Link Parsing               ✓
Link Indexing              ✓
Link Resolution            ✓
Backlinks Mapping          ✓
Tag Extraction             ✓
Real-time Updates          ✓
────────────────────────────────────────────────
Go to Link Command                  ✓
Backlinks View                      ✓
Quick Link Create                   ✓
Link Hover Preview                  ✓
Validation Commands                 ✓
────────────────────────────────────────────────
File Watcher                               ✓
Index Persistence                          ✓
Link Autocomplete                          ✓
Graph Visualization                        ✓
Tag Tree View                              ✓
Advanced Search                            ✓
────────────────────────────────────────────
Performance Optimized                      ✓
Caching & Memoization                      ✓
Scales to 1000+ notes                      ✓
```

---

## Error Handling Strategy

```
Parsing Errors
│
├─ Malformed link [[invalid}
│  └─ Log warning, skip link
│
├─ Encoding issue (UTF-8)
│  └─ Try fallback encoding
│
└─ Very large file (>50MB)
   └─ Stream parse, handle in chunks


Resolution Errors
│
├─ Target file not found
│  └─ Mark broken, show candidates
│
├─ Circular links (A->B->C->A)
│  └─ Detect, warn user
│
└─ Ambiguous link
   └─ Show candidates, let user pick


Index Errors
│
├─ File being rewritten
│  └─ Debounce updates (500ms)
│
├─ Permission denied
│  └─ Skip file, log error
│
└─ Out of memory
   └─ Implement lazy loading, cache strategies
```

---

## Integration Points with Existing Features

```
Daily Notes
    ↓
    Can include [[links]] and [[references]]
    ↓
    LinkParser extracts links from note
    ↓
    LinkIndexService indexes the note
    ↓
    Backlinks view shows what links to this daily note
    ↓
    "Go to Link" command navigates between notes


Template System
    ↓
    Template can include [[note-placeholders]]
    ↓
    Variables like {{date}} create note names
    ↓
    Users create links in templates
    ↓
    Links from template notes indexed normally


File Operations
    ↓
    FileUtils.getMarkdownFiles() - get files to index
    ↓
    FileUtils.readFile() - read for parsing
    ↓
    FileUtils.openOrCreateFile() - quick link create
    ↓
    FileUtils watch - trigger incremental updates (Phase 3)


Configuration System
    ↓
    lkap.notesPath - where to look for notes
    ↓
    lkap.enableBidirectionalLinks - feature toggle
    ↓
    lkap.linkFormat - which formats to support
    ↓
    lkap.excludePatterns - files to skip
```

---

## Success Metrics by Phase

**Phase 1 Complete:**
- [ ] Index builds for 100 notes in <2 seconds
- [ ] Link parser extracts 100% of links correctly
- [ ] 80%+ unit test coverage
- [ ] No memory leaks on large datasets
- [ ] All types compile without errors
- [ ] No console warnings on activation

**Phase 2 Complete:**
- [ ] Users can navigate all links
- [ ] Backlinks view updates in real-time
- [ ] Quick link creation works smoothly
- [ ] Hover preview shows in <100ms
- [ ] All commands work without errors
- [ ] No performance degradation on UI operations

**Phase 3 Complete:**
- [ ] File watcher triggers incremental updates
- [ ] Index loads from cache in <100ms
- [ ] Auto-completion works and is helpful
- [ ] Graph visualization renders in <1 second
- [ ] Scales to 1000+ notes
- [ ] Advanced search finds results in <500ms

---

This visual summary should help you understand the architecture at a glance while working with the detailed documents.
