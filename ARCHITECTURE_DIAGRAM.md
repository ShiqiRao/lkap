# LKAP Phase 2 Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        VSCode Extension Host                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    LKAP Extension Context                       │   │
│  │                                                                 │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │              Phase 2 Features Active                     │  │   │
│  │  │                                                          │  │   │
│  │  │  ┌─────────────────────────────────────────────────┐   │  │   │
│  │  │  │          LinkIndexService                       │   │  │   │
│  │  │  │  ┌────────────────────────────────────────┐    │   │  │   │
│  │  │  │  │  Index: LinkIndex                      │    │   │  │   │
│  │  │  │  │  ├── files: Map<path, FileIndex>       │    │   │  │   │
│  │  │  │  │  ├── backlinks: Map<path, Set<paths>>  │    │   │  │   │
│  │  │  │  │  ├── tags: Map<tag, Set<paths>>        │    │   │  │   │
│  │  │  │  │  └── metadata: { totalFiles, ... }     │    │   │  │   │
│  │  │  │  └────────────────────────────────────────┘    │   │  │   │
│  │  │  │           ↓ onIndexChanged Event ↓             │   │  │   │
│  │  │  │     (fired on file changes, config)            │   │  │   │
│  │  │  └─────────────────────────────────────────────────┘   │  │   │
│  │  │           ↑                                  ↑          │  │   │
│  │  │           │                                  │          │  │   │
│  │  │    ┌──────┴──────┐              ┌────────────┴─────┐   │  │   │
│  │  │    │             │              │                  │   │  │   │
│  │  │    ▼             ▼              ▼                  ▼   │  │   │
│  │  │ ┌─────────────────────────┐ ┌──────────────────────┐  │  │   │
│  │  │ │ BacklinksViewProvider   │ │ TagsViewProvider     │  │  │   │
│  │  │ │                         │ │                      │  │  │   │
│  │  │ │ Tree: BacklinkItem[]    │ │ Tree: TagItem[]      │  │  │   │
│  │  │ │                         │ │  └─ files           │  │  │   │
│  │  │ │ • Subscribes to:        │ │ • Subscribes to:     │  │  │   │
│  │  │ │   - onIndexChanged      │ │   - onIndexChanged   │  │  │   │
│  │  │ │   - onDidChangeEditor   │ │                      │  │  │   │
│  │  │ │ • Updates on editor     │ │ • Updates on:        │  │  │   │
│  │  │ │   switch                │ │   - Index rebuild    │  │  │   │
│  │  │ │ • Updates on index      │ │   - Tag changes      │  │  │   │
│  │  │ │   change                │ │                      │  │  │   │
│  │  │ └─────────────────────────┘ └──────────────────────┘  │  │   │
│  │  │        ↓                             ↓                 │  │   │
│  │  │   onDidChangeTreeData         onDidChangeTreeData     │  │   │
│  │  │        ↓                             ↓                 │  │   │
│  │  │  ┌──────────────────────────────────────────────┐    │  │   │
│  │  │  │   VSCode Tree View Rendering                │    │  │   │
│  │  │  │   • Calls getTreeItem() for each node       │    │  │   │
│  │  │  │   • Calls getChildren() for expansion       │    │  │   │
│  │  │  │   • Updates UI in Explorer sidebar          │    │  │   │
│  │  │  └──────────────────────────────────────────────┘    │  │   │
│  │  └─────────────────────────────────────────────────────────┘  │   │
│  │                                                               │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │          Other Phase 2 Features                      │   │   │
│  │  │  • Link Navigation (lkap.goToLink)                  │   │   │
│  │  │  • Quick Link Create (lkap.createFromLink)          │   │   │
│  │  │  • Link Hover Provider                              │   │   │
│  │  │  • Link Validation & Index Rebuild Commands         │   │   │
│  │  │                                                      │   │   │
│  │  │  All use LinkResolver & BacklinksProvider           │   │   │
│  │  │  All depend on LinkIndexService                     │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  │                                                               │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
        ↓
    File System
    ├── workspace/
    │   ├── notes/
    │   │   ├── daily-standup.md
    │   │   ├── project-x.md
    │   │   ├── team-handbook.md
    │   │   └── ...
    │   └── .vscode/settings.json
    │
    └── User edits files
        └─ Triggers LinkIndexService rebuild
           └─ Emits onIndexChanged
              └─ Updates both views
```

## Component Interaction Flow

### When User Opens a File

```
1. User clicks file in editor
   ↓
2. vscode.window.onDidChangeActiveTextEditor fires
   ↓
3. BacklinksViewProvider.updateCurrentFile(newPath)
   ├─ Sets this.currentFile = newPath
   └─ Calls refreshBacklinks()
      └─ Gets backlinks for newPath from BacklinksProvider
         └─ Returns FileIndex[] from index.backlinks
            └─ Converts to BacklinkItem[]
               ├─ Sorts by title
               └─ Fires onDidChangeTreeData
                  ↓
4. VSCode Explorer updates
   ├─ Calls getChildren() with no element (root)
   │  └─ Returns this.backlinks (current backlinks)
   └─ Calls getTreeItem() for each BacklinkItem
      └─ Creates vscode.TreeItem with:
         ├─ Label: file title
         ├─ Description: link count
         ├─ Icon: link icon
         └─ Command: vscode.open
```

### When Index Changes (File Saved)

```
1. User edits and saves markdown file
   ↓
2. FileWatcher detects change
   ↓
3. LinkIndexService.updateFile(filePath, content)
   ├─ Debounce timeout (500ms)
   ├─ Parse links and tags from content
   ├─ Update index structures:
   │  ├─ files map
   │  ├─ backlinks map
   │  └─ tags map
   ├─ Fires onIndexChanged(newIndex)
   │  │
   │  ├─ BacklinksViewProvider receives event
   │  │  └─ Calls refreshBacklinks() (if file is current)
   │  │     └─ Fires onDidChangeTreeData
   │  │        └─ VSCode updates backlinks in sidebar
   │  │
   │  └─ TagsViewProvider receives event
   │     └─ Calls updateTags()
   │        ├─ Rebuilds tags array from index.tags
   │        └─ Fires onDidChangeTreeData
   │           └─ VSCode updates tags in sidebar
   │
   └─ Other subscribers:
      ├─ LinkResolver.updateIndex()
      └─ BacklinksProvider.updateIndex()
```

## Tag View Data Structure

```
LinkIndex.tags: Map<string, Set<string>>
│
├─ "important" → Set [ "/path/to/file1.md", "/path/to/file2.md" ]
├─ "project-x" → Set [ "/path/to/file3.md", "/path/to/file4.md", ... ]
├─ "review" → Set [ "/path/to/file5.md" ]
└─ "todo" → Set [ "/path/to/file6.md", "/path/to/file7.md" ]

Converted to TagItem[]:
│
├─ { tag: "important", count: 2, files: [...], collapsibleState: Collapsed }
├─ { tag: "project-x", count: 3, files: [...], collapsibleState: Collapsed }
├─ { tag: "review", count: 1, files: [...], collapsibleState: Collapsed }
└─ { tag: "todo", count: 2, files: [...], collapsibleState: Collapsed }

When expanded:
├─ "important (2)" ← TagItem
│  ├─ "file1" ← TagFileItem
│  └─ "file2" ← TagFileItem
├─ "project-x (3)" ← TagItem
│  ├─ "file3" ← TagFileItem
│  ├─ "file4" ← TagFileItem
│  └─ "..." ← TagFileItem
└─ ...
```

## Backlinks View Data Structure

```
LinkIndex.backlinks: Map<string, Set<string>>
│
└─ "/path/to/current-file.md" → Set [
     "/path/to/source1.md",  ← Files that link TO current file
     "/path/to/source2.md",
     "/path/to/source3.md"
   ]

Converted to BacklinkItem[]:
│
├─ { filePath: "...", fileName: "source1", title: "source1", linkCount: 2 }
├─ { filePath: "...", fileName: "source2", title: "source2", linkCount: 1 }
└─ { filePath: "...", fileName: "source3", title: "source3", linkCount: 3 }

Displayed as flat list (no hierarchy):
├─ link source1 (2 links)
├─ link source2 (1 link)
└─ link source3 (3 links)
```

## Event Subscription Lifecycle

### On Activation

```
LinkIndexService created
└─ indexChangeEmitter created
   └─ Immediately builds index

extension.ts calls registerBacklinksViewProvider()
└─ BacklinksViewProvider created
   ├─ Subscribes to window.onDidChangeActiveTextEditor
   ├─ Subscribes to linkIndexService.onIndexChanged
   ├─ Sets initial file
   └─ Registers with VSCode tree view API

extension.ts calls registerTagsViewProvider()
└─ TagsViewProvider created
   ├─ Gets initial index
   ├─ Subscribes to linkIndexService.onIndexChanged
   └─ Registers with VSCode tree view API

Both providers added to context.subscriptions
```

### During Usage

```
User edits file
├─ LinkIndexService detects change (debounced)
└─ Fires onIndexChanged event
   ├─ BacklinksViewProvider.onIndexChanged handler
   │  └─ If current file, refresh its backlinks
   │     └─ Fire onDidChangeTreeData
   │        └─ VSCode calls getChildren() and getTreeItem()
   │
   └─ TagsViewProvider.onIndexChanged handler
      └─ Always refresh tags
         └─ Fire onDidChangeTreeData
            └─ VSCode calls getChildren() and getTreeItem()
```

### On Deactivation

```
extension.deactivate() called
└─ context.subscriptions disposed
   ├─ BacklinksViewProvider.dispose()
   │  └─ onDidChangeTreeDataEmitter.dispose()
   │     └─ All subscriptions cleared
   │
   └─ TagsViewProvider.dispose()
      └─ onDidChangeTreeDataEmitter.dispose()
         └─ All subscriptions cleared

Both providers unregistered from VSCode
```

---

This diagram shows how Tags View and Backlinks View integrate with the LKAP extension architecture, manage their state, and respond to file and index changes.
