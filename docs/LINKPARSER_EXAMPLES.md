# LinkParser Usage Examples

This document provides practical examples of how to use the `LinkParser` class for the LKAP extension.

## Table of Contents
1. [Basic Parsing](#basic-parsing)
2. [Extracting Specific Link Types](#extracting-specific-link-types)
3. [Tag Extraction and Management](#tag-extraction-and-management)
4. [Link Normalization](#link-normalization)
5. [Position and Range Handling](#position-and-range-handling)
6. [Error Handling](#error-handling)
7. [Integration Patterns](#integration-patterns)

## Basic Parsing

### Parse Complete Markdown Content

```typescript
import { LinkParser } from './utils/linkUtils';

const markdownContent = `
# Daily Note - 2024-01-15

## Overview
This note links to [[project-planning]] and references [my-goals](goals.md).

It also mentions #productivity and #work-in-progress tasks.

## Details
- See [[related-notes]] for context
- Check [resources](resources.md) for more info
- Tagged with #important and #review-needed
`;

const result = LinkParser.parseLinks(
  markdownContent,
  '/workspace/notes/2024-01-15.md'
);

console.log('Found links:', result.links.length);      // 4
console.log('Found tags:', result.tags);               // ['important', 'productivity', ...]
console.log('Errors:', result.errors);                 // []
```

## Extracting Specific Link Types

### Only Wiki-Style Links

```typescript
const wikiContent = `
[[daily-notes|Daily]]
[[project-status]]
[markdown-link](target.md)
More wiki links: [[another]]
`;

const wikiMatches = LinkParser.extractWikilinks(wikiContent);
console.log('Wiki links found:', wikiMatches.length); // 3
```

### Only Markdown Links

```typescript
const mdContent = `
[Click here](page.md)
[Another link](notes/overview.md)
[[not-markdown]]
`;

const mdMatches = LinkParser.extractMarkdownLinks(mdContent);
console.log('Markdown links found:', mdMatches.length); // 2
```

## Tag Extraction and Management

### Extract All Tags

```typescript
const contentWithTags = `
#productivity #work
Today's focus: #focus #important
Repeated: #work and #productivity
`;

const tags = LinkParser.extractTags(contentWithTags);
console.log('Unique tags:', tags);
// ['focus', 'important', 'productivity', 'work'] - sorted and unique
```

## Link Normalization

### Convert Various Formats

```typescript
LinkParser.normalizeLinkTarget('My Document');           // 'my-document.md'
LinkParser.normalizeLinkTarget('TODO');                  // 'todo.md'
LinkParser.normalizeLinkTarget('my-note.md');            // 'my-note.md'
LinkParser.normalizeLinkTarget('  spaces  around  ');    // 'spaces-around.md'
LinkParser.normalizeLinkTarget('My_Important_Note');     // 'my-important-note.md'
LinkParser.normalizeLinkTarget('CamelCase');             // 'camelcase.md'
```

## Position and Range Handling

### Convert Text Offsets to Positions

```typescript
const content = `Line 0
Line 1
Line 2`;

const pos = LinkParser.getPositionFromOffset(content, 10);
console.log(pos.line);      // 1
console.log(pos.character); // 3

// Use with VSCode Editor
editor.selection = new vscode.Selection(pos, pos);
```

## Error Handling

### Graceful Degradation

```typescript
const problematicContent = `
Valid link: [[good-note]]
Empty link: [[]]
Real link: [[another]]
#tag #another-tag
`;

const result = LinkParser.parseLinks(
  problematicContent,
  '/test.md'
);

console.log('Successfully parsed links:', result.links.length); // 2
console.log('Tags found:', result.tags);                        // ['another-tag', 'tag']
console.log('Errors:', result.errors);                          // Collected errors

if (result.errors.length > 0) {
  vscode.window.showWarningMessage(
    `Parsed with ${result.errors.length} warnings`
  );
}
```

## Integration Patterns

### Complete Note Indexing Workflow

```typescript
import { LinkParser } from './utils/linkUtils';
import { FileIndex } from './types';

async function indexNote(filePath: string): Promise<FileIndex> {
  // Read file content
  const content = await readFileContent(filePath);

  // Parse all links and tags
  const parseResult = LinkParser.parseLinks(content, filePath);

  // Create hash for change detection
  const contentHash = LinkParser.hashContent(content);

  // Build file index
  const fileIndex: FileIndex = {
    path: filePath,
    name: getFileNameWithoutExt(filePath),
    lastIndexed: Date.now(),
    contentHash,
    outgoingLinks: parseResult.links,
    metadata: {
      title: extractTitle(content),
      modifiedAt: Date.now(),
      size: content.length
    }
  };

  return fileIndex;
}
```

### Find All Backlinks to a Note

```typescript
function findBacklinks(targetNote: string): Array<{
  sourceFile: string;
  links: LinkInstance[];
}> {
  const normalizedTarget = LinkParser.normalizeLinkTarget(targetNote);
  const backlinks = [];

  // Search through all indexed files
  for (const [filePath, fileIndex] of globalIndex.files) {
    const matchingLinks = fileIndex.outgoingLinks.filter(link => {
      const normalizedLink = LinkParser.normalizeLinkTarget(link.title);
      return normalizedLink === normalizedTarget;
    });

    if (matchingLinks.length > 0) {
      backlinks.push({
        sourceFile: filePath,
        links: matchingLinks
      });
    }
  }

  return backlinks;
}
```

## Performance Considerations

### Batch Processing

```typescript
// Process multiple files in parallel (LinkParser is stateless)
async function indexWorkspace(filePaths: string[]): Promise<Map<string, FileIndex>> {
  const indexes = new Map<string, FileIndex>();

  await Promise.all(
    filePaths.map(async (filePath) => {
      const content = await readFile(filePath);
      const result = LinkParser.parseLinks(content, filePath);
      indexes.set(filePath, buildFileIndex(filePath, result));
    })
  );

  return indexes;
}
```

## Conclusion

The `LinkParser` class provides a robust API for extracting links and tags from Markdown content with excellent performance and error handling. For more information, see:
- `src/utils/linkUtils.ts` - Implementation
- `src/types/index.ts` - Type definitions
- `LINKPARSER_IMPLEMENTATION.md` - Technical documentation
