# LKAP Phase 2 UI Views - Visual Guide

## Extension Sidebar Layout

```
Explorer
├── LKAP
│   ├── 📁 Tags                           (New Tags View)
│   │   ├── 📌 #important (5)
│   │   │   ├── 📄 daily-standup
│   │   │   ├── 📄 meeting-notes
│   │   │   ├── 📄 project-kickoff
│   │   │   ├── 📄 retrospective
│   │   │   └── 📄 sprint-review
│   │   ├── 📌 #project-a (8)
│   │   │   ├── 📄 architecture
│   │   │   ├── 📄 design-doc
│   │   │   ├── 📄 implementation
│   │   │   ├── 📄 meeting-2024-11-01
│   │   │   ├── 📄 meeting-2024-11-08
│   │   │   ├── 📄 progress-notes
│   │   │   ├── 📄 requirements
│   │   │   └── 📄 weekly-update
│   │   ├── 📌 #review (3)
│   │   │   ├── 📄 code-review-checklist
│   │   │   ├── 📄 design-review
│   │   │   └── 📄 qa-testing
│   │   └── 📌 #todo (2)
│   │       ├── 📄 backlog-items
│   │       └── 📄 current-tasks
│   │
│   └── 🔗 Backlinks                     (Existing Backlinks View)
│       ├── 📄 project-overview (2 links)
│       ├── 📄 team-handbook (1 link)
│       └── 📄 weekly-status (3 links)
│
└── [Other VSCode Views...]
```

## View Components

### Tags View Details

**Title:** Tags
**Icon:** 📌 (tag icon)
**Parent ID:** explorer
**View ID:** lkap.tagView

**Structure:**
- Root: All tags (flat list, alphabetically sorted)
- Level 1: Individual tag (collapsible)
- Level 2: Files with that tag (files, not collapsible)

**Each Tag Displays:**
- Tag name (e.g., "important")
- Count in parentheses (e.g., "(5)")
- Tooltip: "5 files with tag #important"

**Each File Displays:**
- File name without extension (e.g., "daily-standup")
- Icon: 📄 (document icon)
- Tooltip: Full file path
- Click: Opens file in editor

### Backlinks View Details

**Title:** Backlinks
**Icon:** 🔗 (link icon)
**Parent ID:** explorer
**View ID:** lkap.backlinksView

**Structure:**
- Root: All backlinks (flat list, alphabetically sorted)
- Level 1: Individual backlink (not collapsible)

**Each Backlink Displays:**
- File name/title (e.g., "project-overview")
- Link count in parentheses (e.g., "(2 links)")
- Icon: 🔗 (link icon)
- Tooltip: Full file path
- Click: Opens file in editor

---

## User Workflows

### Workflow 1: Browse All Tags

**User Action:**
1. Look at LKAP → Tags section in Explorer
2. See all tags sorted alphabetically with counts
3. Click on a tag to expand
4. See all files with that tag

**What Happens:**
- Tags displayed instantly
- Counts are accurate
- Files sorted alphabetically
- Click opens file

**Data Source:** LinkIndex.tags map

---

### Workflow 2: See Files Linking Here

**User Action:**
1. Open a note in editor (e.g., "project-x.md")
2. Look at LKAP → Backlinks section in Explorer
3. See all files that link to this note
4. Click on a backlink to navigate

**What Happens:**
- View updates when switching notes
- Shows correct backlinks for current file
- Counts links correctly
- Click opens source file

**Data Source:** LinkIndex.backlinks map

---

### Workflow 3: Real-time Updates

**User Action (Tags View):**
1. Add "#urgent" tag to a note
2. Look at Tags view

**What Happens:**
- Tag appears in view (if not already there)
- Count increases automatically
- View updates within <100ms

---

**User Action (Backlinks View):**
1. Open note "daily-standup.md"
2. Add link to this file in another note: `[[daily-standup]]`
3. Look at Backlinks view

**What Happens:**
- New backlink appears in view
- Count updates automatically
- View synchronizes with index

---

## Technical Integration

### Event Flow

```
File Changes (User edits markdown)
    ↓
FileWatcher (detects change)
    ↓
LinkIndexService.updateFile()
    ↓
Index updated (rebuild tags/backlinks maps)
    ↓
onIndexChanged event fired
    ↓
TagsViewProvider.updateTags()  ← Refreshes tags
BacklinksViewProvider.refreshBacklinks()  ← Refreshes backlinks
    ↓
UI updates (tree views re-render)
```

### State Management

```
LinkIndexService
├── index: LinkIndex
│   ├── files: Map<path, FileIndex>
│   ├── backlinks: Map<path, Set<paths>>  ← Used by BacklinksViewProvider
│   └── tags: Map<tag, Set<paths>>        ← Used by TagsViewProvider
└── onIndexChanged: Event<LinkIndex>
    └── Both view providers subscribe here
```

---

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Initial load (100 notes) | <500ms | Show all tags and backlinks |
| Switch between files | <50ms | Update backlinks for new file |
| Add one tag | <100ms | Update tags count |
| Add one backlink | <100ms | Update backlinks count |
| Index rebuild (100 notes) | <2s | Full re-parse and re-index |

---

## Error Handling

### Tags View

| Scenario | Behavior |
|----------|----------|
| No tags found | View shows empty state |
| Index rebuild fails | Previous state retained, error logged |
| Tag with no files | Shows tag with (0) count |
| Very long tag name | Truncated with ellipsis, full name in tooltip |

### Backlinks View

| Scenario | Behavior |
|----------|----------|
| No active file | View shows empty state |
| No backlinks to file | View shows empty state |
| File closed | View clears, waits for new active file |
| Index rebuild fails | Previous state retained, error logged |

---

## Accessibility Features

### Keyboard Navigation

Both views support standard VSCode tree navigation:
- **Arrow Up/Down:** Navigate between items
- **Left/Right:** Collapse/expand groups
- **Enter:** Open selected file
- **Space:** Toggle expansion

### Visual Indicators

- **Icons:** Tag (📌) and Link (🔗) for quick identification
- **Descriptions:** Count shown in parentheses for quick scanning
- **Tooltips:** Full paths visible on hover
- **Sorting:** Alphabetical for predictable navigation

---

## Integration Points

### With Other Phase 2 Features

**Link Navigation (lkap.goToLink)**
- Backlinks view provides alternative navigation
- Both use LinkResolver for link resolution
- Updates trigger together

**Link Hover (LinkHoverProvider)**
- Shows preview of links
- Complements backlinks view
- Same index data

**Quick Link Create (lkap.createFromLink)**
- Create missing link targets
- Creates new files
- Index updates → Both views refresh

---

## Future Enhancements

### Phase 3: Advanced Tag Features
- [ ] Tag hierarchy (#parent-child)
- [ ] Tag colors in view
- [ ] Filter backlinks by tag
- [ ] Tag search/autocomplete

### Phase 3: Performance
- [ ] Virtual scrolling for 1000+ tags
- [ ] Incremental tree updates
- [ ] Index persistence

### Phase 3: Visualization
- [ ] Tag cloud view
- [ ] Graph view showing tag relationships
- [ ] Export tag hierarchy

---

## Quick Reference

### Package.json Contributions

```json
{
  "views": {
    "explorer": [
      {
        "id": "lkap.tagView",           // ← Tags View
        "name": "Tags",
        "when": "lkap.enabled"
      },
      {
        "id": "lkap.backlinksView",     // ← Backlinks View
        "name": "Backlinks",
        "when": "lkap.enabled"
      }
    ]
  }
}
```

### File Structure

```
src/views/
├── backlinksView.ts      (Existing - Fully implemented)
└── tagsView.ts           (New - Fully implemented)
```

### Extension Activation

```typescript
// In extension.ts activate()
registerBacklinksViewProvider(context, backlinksProvider, linkIndexService);
registerTagsViewProvider(context, linkIndexService);
```

Both views are active whenever `lkap.enabled` context is true (set during activation).

---

## Summary

The LKAP extension now provides two powerful sidebar views for exploring your notes:

1. **Tags View** - Browse all tags and their associated files
2. **Backlinks View** - See which files link to the current file

Both views are:
- Real-time synchronized with the note index
- Fully integrated with VSCode's tree view API
- Responsive and performant
- Properly cleaned up on deactivation

They work together with other Phase 2 features to provide a complete linking and navigation experience.
