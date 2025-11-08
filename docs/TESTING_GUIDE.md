# Quick Start: Testing LKAP UI Views

## Prerequisites

- VSCode 1.74.0 or later
- Node.js and npm installed
- LKAP extension source code

## Step 1: Build the Extension

```bash
cd D:\development\lkap
npm install  # if needed
npm run compile
```

Expected output:
```
[watch] build finished
```

## Step 2: Start Debugging

1. Press **F5** in VSCode
2. A new VSCode window opens with the extension running
3. Check the Debug Console for logs starting with "Link Knowledge And Plan extension is activating..."

## Step 3: Create Test Notes

In the debug VSCode window, create a workspace with notes:

```bash
# Create workspace folder
mkdir test-workspace
cd test-workspace

# Create notes directory
mkdir notes

# Create sample notes (in debug VSCode editor)
```

### Sample Note 1: `notes/project-x.md`
```markdown
# Project X

## Overview
This is the main project overview document.

## Related Notes
- [[team-handbook]]
- [[architecture-design]]
- [[requirements]]

#important #project-x #active
```

### Sample Note 2: `notes/team-handbook.md`
```markdown
# Team Handbook

Team processes and guidelines.

See also: [[project-x]]

#handbook #procedures
```

### Sample Note 3: `notes/architecture-design.md`
```markdown
# Architecture Design

Design decisions for [[project-x]].

Also related to: [[project-a]]

#project-x #design #documentation
```

### Sample Note 4: `notes/requirements.md`
```markdown
# Requirements

Feature requirements for [[project-x]] and [[project-a]].

#project-x #project-a #planning
```

### Sample Note 5: `notes/project-a.md`
```markdown
# Project A

Another project with shared requirements from [[requirements]].

#project-a #active
```

## Step 4: Open the Notes Workspace

1. In debug VSCode: **File** → **Open Folder** → Select `test-workspace`
2. VSCode asks to trust workspace → click "Yes"
3. The extension activates automatically
4. Check **Output Panel** → **LKAP Output** for index building logs

Expected log output:
```
Link Knowledge And Plan extension is activating...
Daily note commands registered successfully
Initializing link index service...
Building initial link index...
Link index built successfully: { totalFiles: 5, totalLinks: 7, totalTags: 6 }
Registering Phase 2 features...
Link navigation command registered
Quick link creation command registered
Backlinks view provider registered
Tags view provider registered
Link hover provider registered
Configuration commands registered
Link Knowledge And Plan extension activated successfully with Phase 2 features!
```

## Step 5: Test Tags View

1. Look at the Explorer sidebar on the left
2. Find **LKAP** section → **Tags** view
3. You should see tags displayed:
   ```
   📌 active (2)
   📌 architecture (1)
   📌 design (1)
   📌 documentation (1)
   📌 handbook (1)
   📌 important (1)
   📌 planning (1)
   📌 procedures (1)
   📌 project-a (3)
   📌 project-x (3)
   ```

### Tags View Test Cases

#### Test 1: Expand a Tag
1. Click arrow next to **#project-x (3)**
2. Should show three files:
   - `architecture-design`
   - `project-x`
   - `requirements`
3. Click arrow again to collapse

#### Test 2: Open a File from Tags
1. Expand **#project-x (3)**
2. Click on `project-x`
3. File should open in the editor

#### Test 3: Verify Counts
1. Look at **#important (1)** - Only `project-x.md` has this
2. Look at **#project-x (3)** - Three files should show
3. Counts should match file contents

#### Test 4: Hover Tooltips
1. Hover over a tag name
2. Tooltip shows: "X files with tag #tagname"
3. Hover over a file name
4. Tooltip shows full file path

#### Test 5: Alphabetical Sort
1. Verify tags are sorted A→Z
2. Files within tags are sorted A→Z

## Step 6: Test Backlinks View

1. In the editor, click on `project-x.md`
2. Look at Explorer sidebar → **LKAP** → **Backlinks**
3. You should see files that link to this file:
   ```
   🔗 architecture-design (1 link)
   🔗 requirements (1 link)
   🔗 team-handbook (1 link)
   ```

### Backlinks View Test Cases

#### Test 1: Switch Files and Backlinks Update
1. Open `project-x.md` in editor
2. Backlinks shows: architecture-design, requirements, team-handbook
3. Click on `requirements.md` in backlinks → It opens
4. Look at backlinks again → Now shows files linking to requirements
5. Should show: `project-a`, `project-x`

#### Test 2: Link Count Display
1. Open `requirements.md`
2. Backlinks shows: `project-a (1 link)`, `project-x (1 link)`
3. Each has correct count based on file content

#### Test 3: Navigate via Backlinks
1. Open `architecture-design.md`
2. Click backlink `project-x` in backlinks view
3. Editor switches to `project-x.md`

#### Test 4: Empty Backlinks
1. Open `team-handbook.md`
2. Backlinks view shows: `project-x (1 link)` only
3. Add a new note with no links
4. Switch to it → Backlinks view shows empty

## Step 7: Test Real-time Updates

### Add a Tag
1. Open `project-x.md`
2. Add to the end: `#urgent`
3. Save the file (Ctrl+S)
4. Watch **LKAP** → **Tags** view
5. A new tag **#urgent** should appear with (1)

### Add a Backlink
1. Open `team-handbook.md`
2. Add to the text: `[[requirements]]`
3. Save the file
4. Open `requirements.md`
5. Check **LKAP** → **Backlinks**
6. Should now show `team-handbook (1 link)` added

## Step 8: Test Commands

Open Command Palette (**Ctrl+Shift+P**) and run:

### Validate Links
```
LKAP: Validate All Links
```
Expected: Shows output panel with validation report

### Rebuild Index
```
LKAP: Rebuild Link Index
```
Expected: Progress notification, then success message

## Step 9: Developer Console

Open Developer Tools (**Help** → **Toggle Developer Tools** in debug VSCode):

### Check Console Logs
Look for logs like:
```
Link index built successfully: { totalFiles: 5, totalLinks: 7, totalTags: 6 }
Link index changed, updating resolvers and providers
```

### Check for Errors
Should see NO errors related to:
- TagsViewProvider
- BacklinksViewProvider
- Link indexing

## Step 10: Test Edge Cases

### Test 1: Large File
1. Open a note
2. Add many tags: `#tag1 #tag2 #tag3 ... #tag20`
3. Save
4. Tags view updates immediately

### Test 2: Many Links
1. Create links to multiple files: `[[file1]] [[file2]] [[file3]] ...`
2. Open each file
3. Backlinks count updates correctly

### Test 3: Rename File
1. Rename `project-x.md` to `project-alpha.md`
2. Backlinks for files linking to it still work
3. (Note: Index may need rebuild for file names)

### Test 4: Delete File
1. Delete a file
2. Run **LKAP: Rebuild Index**
3. Views update, removed file disappears

## Troubleshooting

### Views Not Showing

1. Check if extension is activated:
   - **View** → **Output** → select **LKAP Output**
   - Should see activation logs

2. Check context is enabled:
   - Press Ctrl+Shift+P
   - Run: `Developer: Inspect Context Keys`
   - Look for `lkap.enabled = true`

3. Check view registrations:
   - Open Debug Console (F12)
   - Run:
     ```javascript
     vscode.window.createTreeView('lkap.tagView', {treeDataProvider: null})
     ```
   - Should work without errors

### Tags/Backlinks Not Showing

1. Check notes are being found:
   - Output panel should show `totalFiles: X`
   - X should match number of markdown files

2. Check tags/links are being parsed:
   - Output should show `totalLinks: X` and total tags count
   - X > 0 means links are found

3. Rebuild index manually:
   - Run **LKAP: Rebuild Index** command
   - Watch Output panel for progress

### Performance Issues

1. If startup is slow:
   - Check workspace size
   - Large workspaces (100+ notes) may take 10-20s

2. If views are unresponsive:
   - Open DevTools and check for errors
   - Try rebuilding index
   - Check console for performance warnings

## Summary

You've now tested:
- ✅ Tags view showing all tags with counts
- ✅ Tags view expandable to show files
- ✅ Backlinks view showing files linking to current file
- ✅ Real-time updates when files change
- ✅ Navigation by clicking on files
- ✅ Edge cases and error handling

Both views are working correctly and ready for use!

## Next Steps

1. Try creating your own notes and links
2. Experiment with tags and see counts update
3. Use backlinks to navigate between related notes
4. Test with more complex linking patterns

## Support

If you encounter issues:
1. Check the Output panel for error messages
2. Open DevTools (F12) and check console
3. Try: **LKAP: Rebuild Link Index**
4. Review logs in VS Code debug terminal
