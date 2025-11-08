# LinkParser Quick Reference

## Import
```typescript
import { LinkParser } from './utils/linkUtils';
```

## Parse Complete Content
```typescript
const result = LinkParser.parseLinks(
  markdownContent,
  '/path/to/file.md',
  { enableWikilinks: true, enableMarkdownLinks: true }
);

// result.links: LinkInstance[]
// result.tags: string[]
// result.errors: string[]
```

## Extract Links Only
```typescript
const wikiMatches = LinkParser.extractWikilinks(content);
const mdMatches = LinkParser.extractMarkdownLinks(content);
```

## Extract Tags Only
```typescript
const tags = LinkParser.extractTags(content); // Unique, sorted, lowercase
```

## Normalize Link Targets
```typescript
const normalized = LinkParser.normalizeLinkTarget('My Document');
// Result: 'my-document.md'
```

## Content Hashing
```typescript
const hash = LinkParser.hashContent(content);
// Result: SHA256 hex string
```

## Position Conversion
```typescript
const pos = LinkParser.getPositionFromOffset(content, 42);
// Result: vscode.Position { line: X, character: Y }
```

## Regex Patterns Used

### Wiki-links
Pattern: `/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g`
Matches: `[[note]]` or `[[note|Display]]`
Groups: 1=target, 2=display

### Markdown Links
Pattern: `/\[([^\]]+)\]\(([^)]+)\)/g`
Matches: `[text](target)`
Groups: 1=display, 2=target

### Tags
Pattern: `/(?:^|\s)#([\w-]+)/g`
Matches: `#tag` or `#multi-word-tag`
Group: 1=tagname

## Error Handling
```typescript
const result = LinkParser.parseLinks(content, file);

if (result.errors.length > 0) {
  console.warn('Parse warnings:', result.errors);
}

// Errors are non-blocking - links and tags are still parsed
```

## Type Definitions

### LinkInstance
```typescript
{
  title: string;               // Original link text
  displayText: string;         // Text to display
  sourceFile: string;          // File containing link
  targetFile: string | null;   // Resolved target (null until resolved)
  range: vscode.Range;         // Position in document
  format: 'wikilink' | 'markdown';
  targetExists: boolean;       // Whether target was found
}
```

### LinkParseResult
```typescript
{
  links: LinkInstance[];
  tags: string[];
  errors: string[];
}
```

## Common Use Cases

### Find all links to a specific file
```typescript
const target = 'my-note.md';
const backlinks = allFiles
  .flatMap(f => f.links)
  .filter(link => LinkParser.normalizeLinkTarget(link.title) === target);
```

### Group notes by tag
```typescript
const byTag = new Map<string, string[]>();

for (const file of files) {
  const result = LinkParser.parseLinks(content, file);
  result.tags.forEach(tag => {
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag)!.push(file);
  });
}
```

### Detect file changes
```typescript
const oldHash = index[file].contentHash;
const newContent = await readFile(file);
const newHash = LinkParser.hashContent(newContent);

if (oldHash !== newHash) {
  // Re-parse file
}
```

### Navigate to link
```typescript
const match = LinkParser.extractWikilinks(content)[0];
const pos = LinkParser.getPositionFromOffset(content, match.index);
editor.selection = new vscode.Selection(pos, pos);
editor.revealRange(new vscode.Range(pos, pos));
```

## Performance Notes

- Regex patterns: O(n) where n = content length
- Tag deduplication: O(m log m) where m = tag count
- Typical file: <5ms for 5KB content
- Thread-safe: Can call in parallel
- Stateless: No initialization overhead

## See Also

- `LINKPARSER_IMPLEMENTATION.md` - Detailed technical docs
- `LINKPARSER_EXAMPLES.md` - Comprehensive examples
- `src/types/index.ts` - Type definitions
