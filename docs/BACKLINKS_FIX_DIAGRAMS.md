# Backlinks Bug Fix - Architecture Diagrams

## System Architecture - Before Fix

```
┌────────────────────────────────────────────────────────────┐
│                   VS Code Extension                         │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │           LinkIndexService.rebuildIndex()          │    │
│  │                                                    │    │
│  │  1. Read markdown files                           │    │
│  │  2. Parse links (targetFile = null)               │    │
│  │  3. Create FileIndex entries                      │    │
│  │  4. Try to populate backlinks:                    │    │
│  │     if (link.targetFile) { ... }  ← ALWAYS FALSE  │    │
│  │  5. Return index with EMPTY backlinks             │    │
│  │                                                    │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │         BacklinksProvider.getBacklinksFor()        │    │
│  │                                                    │    │
│  │  Query: index.backlinks.get(filePath)             │    │
│  │  Result: empty Set or undefined                   │    │
│  │  Return: []                                        │    │
│  │                                                    │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │            BacklinksView (Tree View)               │    │
│  │                                                    │    │
│  │  Display: [No incoming links]                      │    │
│  │                                                    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ⚠️ Problem: All components work correctly, but they       │
│     operate on EMPTY data from the index                   │
└────────────────────────────────────────────────────────────┘

Note: LinkResolver exists but is never called during indexing!
```

## System Architecture - After Fix

```
┌────────────────────────────────────────────────────────────┐
│                   VS Code Extension                         │
│                                                              │
│  ┌─────────────── PASS 1: PARSE ──────────────────────┐   │
│  │                                                    │   │
│  │  LinkIndexService.rebuildIndex()                  │   │
│  │  1. Read markdown files                           │   │
│  │  2. Parse links (targetFile = null)               │   │
│  │  3. Create FileIndex with unresolved links        │   │
│  │  4. Populate files map                            │   │
│  │  5. Populate tags map                             │   │
│  │  6. Skip backlinks (not resolved yet)             │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                  │
│  ┌─────────────── PASS 2: RESOLVE ───────────────────┐   │
│  │                          ↓                         │   │
│  │  ┌──────────────────────────────────────────┐    │   │
│  │  │     Create LinkResolver(index)           │    │   │
│  │  │                                          │    │   │
│  │  │  For each file's outgoing links:         │    │   │
│  │  │    ├─ Call resolver.resolveLink()        │    │   │
│  │  │    ├─ targetFile gets actual path ✓      │    │   │
│  │  │    └─ Update link with resolved target   │    │   │
│  │  │                                          │    │   │
│  │  │  Now add backlinks:                      │    │   │
│  │  │    if (resolution.targetFile) { ... }    │    │   │
│  │  │       ✓ TRUE - finally works!            │    │   │
│  │  │                                          │    │   │
│  │  └──────────────────────────────────────────┘    │   │
│  │                                                   │   │
│  │  Result: Backlinks map FULLY POPULATED           │   │
│  │                                                   │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ↓                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │         BacklinksProvider.getBacklinksFor()        │   │
│  │                                                    │   │
│  │  Query: index.backlinks.get(filePath)             │   │
│  │  Result: Set of source files ✓                    │   │
│  │  Return: [FileIndex, FileIndex, ...]              │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ↓                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │            BacklinksView (Tree View)               │   │
│  │                                                    │   │
│  │  Display:                                         │   │
│  │    ✓ note-a.md links here                         │   │
│  │    ✓ note-c.md links here                         │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                              │
│  ✓ All components work with COMPLETE data!                 │
└────────────────────────────────────────────────────────────┘

Key: LinkResolver is now called during indexing!
```

## Data Flow Diagram

### Before (Broken)

```
Files on Disk:
  a.md: "[[My Note]]"
  my-note.md: "# My Note"

  ↓ (scan and parse)

LinkIndexService:
  files: {
    "/a.md": { path, name, outgoingLinks: [
      { title: "My Note", targetFile: null }  ← BUG
    ]},
    "/my-note.md": { ... }
  }
  backlinks: {} ← EMPTY (condition skipped)
  tags: { ... }

  ↓ (query)

BacklinksProvider.getBacklinksFor("/my-note.md"):
  return []  ← No backlinks found

  ↓ (display)

BacklinksView: [No incoming links]  ← User sees nothing
```

### After (Fixed)

```
Files on Disk:
  a.md: "[[My Note]]"
  my-note.md: "# My Note"

  ↓ (PASS 1: scan and parse)

LinkIndexService (intermediate):
  files: {
    "/a.md": { path, name, outgoingLinks: [
      { title: "My Note", targetFile: null }  ← Still null
    ]},
    "/my-note.md": { ... }
  }
  backlinks: {} ← Empty (not added yet)
  tags: { ... }

  ↓ (PASS 2: resolve with LinkResolver)

LinkResolver.resolveLink():
  "My Note" + exact/fuzzy/substring matching
  → /my-note.md ✓

LinkIndexService (after resolution):
  files: {
    "/a.md": { path, name, outgoingLinks: [
      { title: "My Note", targetFile: "/my-note.md" }  ← RESOLVED!
    ]},
    "/my-note.md": { ... }
  }
  backlinks: {
    "/my-note.md": Set("/a.md")  ← NOW POPULATED!
  }
  tags: { ... }

  ↓ (query)

BacklinksProvider.getBacklinksFor("/my-note.md"):
  return [FileIndex("/a.md")]  ← Correct result!

  ↓ (display)

BacklinksView:
  ✓ a.md links here  ← User sees correct data!
```

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    LinkIndexService                      │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │         rebuildIndex(): LinkIndex                │   │
│  │                                                  │   │
│  │  1. FileUtils.getMarkdownFiles()                │   │
│  │  2. LinkParser.parseLinks()  ← Parse only       │   │
│  │  3. Build initial index                         │   │
│  │  4. ┌──────────────────────────────────────┐   │   │
│  │     │ NEW: LinkResolver resolution        │   │   │
│  │     │ ┌────────────────────────────────┐   │   │   │
│  │     │ │ For each link:                 │   │   │   │
│  │     │ │ resolver.resolveLink()         │   │   │   │
│  │     │ │ ↓ (tries exact match)          │   │   │   │
│  │     │ │ ↓ (tries fuzzy match)          │   │   │   │
│  │     │ │ ↓ (finds target file)          │   │   │   │
│  │     │ │ return resolution              │   │   │   │
│  │     │ └────────────────────────────────┘   │   │   │
│  │     │ Add to backlinks map                │   │   │
│  │     └──────────────────────────────────────┘   │   │
│  │  5. Fire onIndexChanged event                  │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                        │                                 │
│                        ├─→ Update event emitter         │
│                        ├─→ LinkResolver field cached    │
│                        └─→ Return populated index       │
│                                                          │
└─────────────────────────────────────────────────────────┘
         │
         ├─→ LinkResolver
         │   ├─ Input: link, sourceFile
         │   ├─ Uses: index (all files)
         │   ├─ Strategy: exact → fuzzy → substring
         │   └─ Output: resolved targetFile
         │
         └─→ BacklinksProvider
             ├─ Subscribes to onIndexChanged
             ├─ Queries backlinks map
             └─ Populates view with results
```

## Link Resolution Strategy (LinkResolver)

```
LinkResolver.resolveLink(link, sourceFile):

  Input: link = { title: "My Note", targetFile: null }

  ├─ 1. Normalize: "My Note" → "my-note.md"
  │
  ├─ 2. Try Exact Match
  │  └─ Compare with all file names (case-sensitive)
  │     └─ "my-note.md" === "my-note.md" ✓ FOUND
  │
  └─ Return: {
       link: { ...link, targetFile: "/absolute/path/my-note.md" },
       targetFile: "/absolute/path/my-note.md",
       exists: true
     }

  If exact fails, tries in order:
    - Case-insensitive match
    - Fuzzy match (typo tolerance)
    - Substring match

  Cache result to avoid redundant computation
```

## Performance Characteristics

```
Index Rebuild Process:

PASS 1 (Parse):
├─ Disk I/O: O(files) + O(size)
├─ Regex parsing: O(content size)
├─ String normalization: O(links)
└─ Time: ~50-100ms for 500 files

PASS 2 (Resolve):
├─ LinkResolver creation: O(files)
├─ For each link: O(files) worst case (all comparisons)
│  ├─ Exact match: O(files) [fast]
│  ├─ Case-insensitive: O(files) [fast]
│  ├─ Fuzzy match: O(files × len) [slower but cached]
│  └─ Cache hit: O(1) [instant]
├─ Backlink insertion: O(links)
└─ Time: ~20-100ms for 500 files (depends on link count)

Total: 70-200ms for typical workspace
Acceptable for background operation

Memory:
├─ Index structure: ~1-5MB for 500 files
├─ LinkResolver cache: ~100KB-1MB
└─ No additional overhead for resolution
```

## Testing the Fix

```
Test Scenario 1: Basic Backlinks
├─ File a.md: "[[my note]]"
├─ File my-note.md: exists
├─ Expected: my-note.md has 1 backlink (from a.md)
└─ Verify: BacklinksView shows "a.md links here"

Test Scenario 2: Fuzzy Matching
├─ File b.md: "[[my noe]]" (typo)
├─ File my-note.md: exists
├─ Expected: Resolved to my-note.md (fuzzy match ≤3 edits)
└─ Verify: Backlink created despite typo

Test Scenario 3: Case Insensitive
├─ File c.md: "[[MY-NOTE]]"
├─ File my-note.md: exists
├─ Expected: Resolved to my-note.md
└─ Verify: Backlink created despite case difference

Test Scenario 4: Multiple Links
├─ File d.md: "[[A]] and [[B]] and [[C]]"
├─ Files a.md, b.md, c.md: exist
├─ Expected: d.md has 3 outgoing links, all resolved
└─ Verify: Each target file shows d.md as backlink
```

---

All diagrams show how the two-pass approach solved the backlinks bug by integrating LinkResolver into the indexing process.
