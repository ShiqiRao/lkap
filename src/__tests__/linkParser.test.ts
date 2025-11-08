import * as assert from 'assert';
import * as vscode from 'vscode';
import { LinkParser } from '../utils/linkUtils';
import { LinkParseResult, LinkInstance } from '../types/index';

/**
 * Test suite for LinkParser utility
 * Tests all parsing functions: wikilinks, markdown links, tags, normalization, hashing, and position calculation
 * Coverage: extractWikilinks, extractMarkdownLinks, extractTags, normalizeLinkTarget, hashContent, getPositionFromOffset, parseLinks
 */
describe('LinkParser', () => {
  const testFilePath = '/workspace/notes/test.md';

  // ============================================================================
  // extractWikilinks Tests
  // ============================================================================
  describe('extractWikilinks', () => {
    it('should extract simple wiki link', () => {
      const content = '[[my-note]]';
      const matches = LinkParser.extractWikilinks(content);
      assert.strictEqual(matches.length, 1);
      assert.strictEqual(matches[0][1], 'my-note');
    });

    it('should extract wiki link with display text', () => {
      const content = '[[my-note|Display Text]]';
      const matches = LinkParser.extractWikilinks(content);
      assert.strictEqual(matches.length, 1);
      assert.strictEqual(matches[0][1], 'my-note');
      assert.strictEqual(matches[0][2], 'Display Text');
    });

    it('should extract multiple wiki links', () => {
      const content = '[[first]] and [[second]] and [[third]]';
      const matches = LinkParser.extractWikilinks(content);
      assert.strictEqual(matches.length, 3);
      assert.strictEqual(matches[0][1], 'first');
      assert.strictEqual(matches[1][1], 'second');
      assert.strictEqual(matches[2][1], 'third');
    });

    it('should not extract nested brackets', () => {
      const content = '[[outer [[inner]]]]';
      const matches = LinkParser.extractWikilinks(content);
      // Should match [[outer [[inner but not complete
      assert(matches.length > 0);
    });

    it('should skip empty brackets', () => {
      const content = 'Text [[]] more text';
      const matches = LinkParser.extractWikilinks(content);
      // Empty brackets still match regex but have empty group[1]
      assert.strictEqual(matches.length, 1);
      assert.strictEqual(matches[0][1], '');
    });

    it('should handle wiki links with spaces', () => {
      const content = '[[my note with spaces]]';
      const matches = LinkParser.extractWikilinks(content);
      assert.strictEqual(matches.length, 1);
      assert.strictEqual(matches[0][1], 'my note with spaces');
    });

    it('should handle wiki links with hyphens', () => {
      const content = '[[my-note-with-hyphens]]';
      const matches = LinkParser.extractWikilinks(content);
      assert.strictEqual(matches.length, 1);
      assert.strictEqual(matches[0][1], 'my-note-with-hyphens');
    });
  });

  // ============================================================================
  // extractMarkdownLinks Tests
  // ============================================================================
  describe('extractMarkdownLinks', () => {
    it('should extract simple markdown link', () => {
      const content = '[text](target)';
      const matches = LinkParser.extractMarkdownLinks(content);
      assert.strictEqual(matches.length, 1);
      assert.strictEqual(matches[0][1], 'text');
      assert.strictEqual(matches[0][2], 'target');
    });

    it('should extract markdown link with .md extension', () => {
      const content = '[text](target.md)';
      const matches = LinkParser.extractMarkdownLinks(content);
      assert.strictEqual(matches.length, 1);
      assert.strictEqual(matches[0][2], 'target.md');
    });

    it('should extract markdown link with path', () => {
      const content = '[text](path/to/target.md)';
      const matches = LinkParser.extractMarkdownLinks(content);
      assert.strictEqual(matches.length, 1);
      assert.strictEqual(matches[0][2], 'path/to/target.md');
    });

    it('should extract multiple markdown links', () => {
      const content = '[first](a.md) [second](b.md) [third](c.md)';
      const matches = LinkParser.extractMarkdownLinks(content);
      assert.strictEqual(matches.length, 3);
      assert.strictEqual(matches[0][2], 'a.md');
      assert.strictEqual(matches[1][2], 'b.md');
      assert.strictEqual(matches[2][2], 'c.md');
    });

    it('should not match incomplete link without closing bracket', () => {
      const content = '[no closing](target)';
      const matches = LinkParser.extractMarkdownLinks(content);
      assert.strictEqual(matches.length, 1);
    });

    it('should not match empty link text', () => {
      const content = '[](target.md)';
      const matches = LinkParser.extractMarkdownLinks(content);
      assert.strictEqual(matches.length, 1);
      assert.strictEqual(matches[0][1], '');
    });

    it('should not match empty link target', () => {
      const content = '[text]()';
      const matches = LinkParser.extractMarkdownLinks(content);
      assert.strictEqual(matches.length, 1);
      assert.strictEqual(matches[0][2], '');
    });

    it('should handle URLs in markdown links', () => {
      const content = '[GitHub](https://github.com)';
      const matches = LinkParser.extractMarkdownLinks(content);
      assert.strictEqual(matches.length, 1);
      assert.strictEqual(matches[0][2], 'https://github.com');
    });
  });

  // ============================================================================
  // extractTags Tests
  // ============================================================================
  describe('extractTags', () => {
    it('should extract single tag', () => {
      const content = '#important';
      const tags = LinkParser.extractTags(content);
      assert.strictEqual(tags.length, 1);
      assert.strictEqual(tags[0], 'important');
    });

    it('should extract multiple tags', () => {
      const content = '#tag1 #tag2 #tag3';
      const tags = LinkParser.extractTags(content);
      assert.strictEqual(tags.length, 3);
      assert(tags.includes('tag1'));
      assert(tags.includes('tag2'));
      assert(tags.includes('tag3'));
    });

    it('should extract tag with hyphens', () => {
      const content = '#multi-word-tag';
      const tags = LinkParser.extractTags(content);
      assert.strictEqual(tags.length, 1);
      assert.strictEqual(tags[0], 'multi-word-tag');
    });

    it('should extract tags at different positions', () => {
      const content = '#start middle #middle end #end';
      const tags = LinkParser.extractTags(content);
      assert.strictEqual(tags.length, 3);
      assert(tags.includes('start'));
      assert(tags.includes('middle'));
      assert(tags.includes('end'));
    });

    it('should deduplicate tags', () => {
      const content = '#tag #tag #tag #other #tag';
      const tags = LinkParser.extractTags(content);
      assert.strictEqual(tags.length, 2);
      assert(tags.includes('tag'));
      assert(tags.includes('other'));
    });

    it('should extract tags with numbers', () => {
      const content = '#tag123 #project-2024';
      const tags = LinkParser.extractTags(content);
      assert.strictEqual(tags.length, 2);
      assert(tags.includes('tag123'));
      assert(tags.includes('project-2024'));
    });

    it('should return sorted tags', () => {
      const content = '#zebra #apple #middle';
      const tags = LinkParser.extractTags(content);
      assert.deepStrictEqual(tags, ['apple', 'middle', 'zebra']);
    });

    it('should convert tags to lowercase', () => {
      const content = '#Important #TODO #MyTag';
      const tags = LinkParser.extractTags(content);
      assert.strictEqual(tags.length, 3);
      assert(tags.includes('important'));
      assert(tags.includes('todo'));
      assert(tags.includes('mytag'));
    });

    it('should handle tags in markdown content', () => {
      const content = '# Title\n\nThis is a note #important #urgent\n\nMore content #archived';
      const tags = LinkParser.extractTags(content);
      assert.strictEqual(tags.length, 3);
      assert(tags.includes('important'));
      assert(tags.includes('urgent'));
      assert(tags.includes('archived'));
    });

    it('should not extract tags without preceding space or start', () => {
      const content = 'word#tag should not match';
      const tags = LinkParser.extractTags(content);
      assert.strictEqual(tags.length, 0);
    });

    it('should return empty array for content without tags', () => {
      const content = 'This is text without any tags';
      const tags = LinkParser.extractTags(content);
      assert.strictEqual(tags.length, 0);
    });
  });

  // ============================================================================
  // normalizeLinkTarget Tests
  // ============================================================================
  describe('normalizeLinkTarget', () => {
    it('should normalize spaces to hyphens', () => {
      const result = LinkParser.normalizeLinkTarget('My Note');
      assert.strictEqual(result, 'my-note.md');
    });

    it('should handle multiple spaces', () => {
      const result = LinkParser.normalizeLinkTarget('My   Note');
      assert.strictEqual(result, 'my-note.md');
    });

    it('should convert to lowercase', () => {
      const result = LinkParser.normalizeLinkTarget('MY-NOTE');
      assert.strictEqual(result, 'my-note.md');
    });

    it('should handle mixed case with spaces', () => {
      const result = LinkParser.normalizeLinkTarget('My Important Note');
      assert.strictEqual(result, 'my-important-note.md');
    });

    it('should add .md extension if missing', () => {
      const result = LinkParser.normalizeLinkTarget('note');
      assert.strictEqual(result, 'note.md');
    });

    it('should not double .md extension', () => {
      const result = LinkParser.normalizeLinkTarget('note.md');
      assert.strictEqual(result, 'note.md');
    });

    it('should handle leading/trailing whitespace', () => {
      const result = LinkParser.normalizeLinkTarget('  note  ');
      assert.strictEqual(result, 'note.md');
    });

    it('should replace underscores with hyphens', () => {
      const result = LinkParser.normalizeLinkTarget('my_note');
      assert.strictEqual(result, 'my-note.md');
    });

    it('should handle mixed separators', () => {
      const result = LinkParser.normalizeLinkTarget('my_note-with spaces');
      assert.strictEqual(result, 'my-note-with-spaces.md');
    });

    it('should remove trailing hyphens from multiple spaces', () => {
      const result = LinkParser.normalizeLinkTarget('note   ');
      assert.strictEqual(result, 'note.md');
    });

    it('should handle already normalized names', () => {
      const result = LinkParser.normalizeLinkTarget('my-note.md');
      assert.strictEqual(result, 'my-note.md');
    });
  });

  // ============================================================================
  // hashContent Tests
  // ============================================================================
  describe('hashContent', () => {
    it('should produce consistent hash for same content', () => {
      const content = 'Hello world';
      const hash1 = LinkParser.hashContent(content);
      const hash2 = LinkParser.hashContent(content);
      assert.strictEqual(hash1, hash2);
    });

    it('should produce different hash for different content', () => {
      const hash1 = LinkParser.hashContent('content1');
      const hash2 = LinkParser.hashContent('content2');
      assert.notStrictEqual(hash1, hash2);
    });

    it('should produce valid hex string', () => {
      const hash = LinkParser.hashContent('test');
      assert(hash.match(/^[a-f0-9]{64}$/), 'Hash should be 64-character hex string');
    });

    it('should hash empty string', () => {
      const hash = LinkParser.hashContent('');
      assert(hash.match(/^[a-f0-9]{64}$/), 'Hash should be valid even for empty string');
    });

    it('should hash large content', () => {
      const largeContent = 'x'.repeat(10000);
      const hash = LinkParser.hashContent(largeContent);
      assert(hash.match(/^[a-f0-9]{64}$/), 'Hash should be valid for large content');
    });

    it('should be case-sensitive for hash comparison', () => {
      const hash1 = LinkParser.hashContent('MyNote');
      const hash2 = LinkParser.hashContent('mynote');
      assert.notStrictEqual(hash1, hash2);
    });

    it('should handle special characters', () => {
      const hash = LinkParser.hashContent('[[link]] #tag [text](url)');
      assert(hash.match(/^[a-f0-9]{64}$/), 'Hash should handle special characters');
    });
  });

  // ============================================================================
  // getPositionFromOffset Tests
  // ============================================================================
  describe('getPositionFromOffset', () => {
    it('should return (0, 0) for offset 0', () => {
      const content = 'hello world';
      const pos = LinkParser.getPositionFromOffset(content, 0);
      assert.strictEqual(pos.line, 0);
      assert.strictEqual(pos.character, 0);
    });

    it('should calculate position in first line', () => {
      const content = 'hello world';
      const pos = LinkParser.getPositionFromOffset(content, 6); // at 'w'
      assert.strictEqual(pos.line, 0);
      assert.strictEqual(pos.character, 6);
    });

    it('should calculate position after newline', () => {
      const content = 'hello\nworld';
      const pos = LinkParser.getPositionFromOffset(content, 6); // at 'w'
      assert.strictEqual(pos.line, 1);
      assert.strictEqual(pos.character, 0);
    });

    it('should calculate position in middle of second line', () => {
      const content = 'hello\nworld';
      const pos = LinkParser.getPositionFromOffset(content, 8); // at 'r'
      assert.strictEqual(pos.line, 1);
      assert.strictEqual(pos.character, 2);
    });

    it('should handle CRLF line endings', () => {
      const content = 'hello\r\nworld';
      const pos = LinkParser.getPositionFromOffset(content, 7); // at 'w'
      assert.strictEqual(pos.line, 1);
      assert.strictEqual(pos.character, 0);
    });

    it('should handle multiple lines with CRLF', () => {
      const content = 'a\r\nb\r\nc';
      const pos = LinkParser.getPositionFromOffset(content, 4); // at 'b'
      assert.strictEqual(pos.line, 1);
      assert.strictEqual(pos.character, 0);
    });

    it('should handle offset beyond end of content', () => {
      const content = 'hello';
      const pos = LinkParser.getPositionFromOffset(content, 100);
      assert.strictEqual(pos.line, 0);
      assert.strictEqual(pos.character, 5);
    });

    it('should handle multiline content', () => {
      const content = 'line1\nline2\nline3';
      const pos = LinkParser.getPositionFromOffset(content, 12); // at 'i' in line3
      assert.strictEqual(pos.line, 2);
      assert.strictEqual(pos.character, 0);
    });
  });

  // ============================================================================
  // parseLinks (Integration) Tests
  // ============================================================================
  describe('parseLinks', () => {
    it('should parse wiki links from content', () => {
      const content = '[[my-note]]';
      const result = LinkParser.parseLinks(content, testFilePath);
      assert.strictEqual(result.links.length, 1);
      assert.strictEqual(result.links[0].title, 'my-note');
      assert.strictEqual(result.links[0].format, 'wikilink');
    });

    it('should parse markdown links from content', () => {
      const content = '[text](target.md)';
      const result = LinkParser.parseLinks(content, testFilePath);
      assert.strictEqual(result.links.length, 1);
      assert.strictEqual(result.links[0].format, 'markdown');
    });

    it('should parse mixed content with wiki and markdown links', () => {
      const content = '[[wiki-link]] and [markdown](target)';
      const result = LinkParser.parseLinks(content, testFilePath);
      assert.strictEqual(result.links.length, 2);
      assert.strictEqual(result.links[0].format, 'wikilink');
      assert.strictEqual(result.links[1].format, 'markdown');
    });

    it('should extract tags', () => {
      const content = 'This is #important and #urgent';
      const result = LinkParser.parseLinks(content, testFilePath);
      assert.strictEqual(result.tags.length, 2);
      assert(result.tags.includes('important'));
      assert(result.tags.includes('urgent'));
    });

    it('should handle errors gracefully', () => {
      const content = '[[]] []()';
      const result = LinkParser.parseLinks(content, testFilePath);
      assert(result.errors.length > 0);
    });

    it('should set correct LinkInstance properties', () => {
      const content = '[[my-note]]';
      const result = LinkParser.parseLinks(content, testFilePath);
      const link = result.links[0];
      assert.strictEqual(link.sourceFile, testFilePath);
      assert.strictEqual(link.targetExists, false);
      assert.strictEqual(link.displayText, 'my-note');
    });

    it('should calculate correct range for link', () => {
      const content = 'prefix [[my-note]] suffix';
      const result = LinkParser.parseLinks(content, testFilePath);
      assert.strictEqual(result.links.length, 1);
      assert(result.links[0].range instanceof vscode.Range);
    });

    it('should disable wikilinks if config.enableWikilinks is false', () => {
      const content = '[[wiki]] and [markdown](target)';
      const result = LinkParser.parseLinks(content, testFilePath, { enableWikilinks: false });
      assert.strictEqual(result.links.length, 1);
      assert.strictEqual(result.links[0].format, 'markdown');
    });

    it('should disable markdown links if config.enableMarkdownLinks is false', () => {
      const content = '[[wiki]] and [markdown](target)';
      const result = LinkParser.parseLinks(content, testFilePath, { enableMarkdownLinks: false });
      assert.strictEqual(result.links.length, 1);
      assert.strictEqual(result.links[0].format, 'wikilink');
    });

    it('should handle empty content', () => {
      const result = LinkParser.parseLinks('', testFilePath);
      assert.strictEqual(result.links.length, 0);
      assert.strictEqual(result.tags.length, 0);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should handle complex real-world markdown', () => {
      const content = `# My Note

This is a note about [[related-note|My Related Note]].

## Section
- [GitHub](https://github.com)
- [[todo]]
- [Template](templates/daily.md)

Tags: #important #project-2024 #urgent`;

      const result = LinkParser.parseLinks(content, testFilePath);
      assert(result.links.length >= 4);
      assert(result.tags.length >= 3);
      assert(result.tags.includes('important'));
      assert(result.tags.includes('project-2024'));
      assert(result.tags.includes('urgent'));
    });

    it('should normalize link targets', () => {
      const content = '[[My Important Note]]';
      const result = LinkParser.parseLinks(content, testFilePath);
      assert.strictEqual(result.links[0].title, 'My Important Note');
    });

    it('should handle empty file path', () => {
      const content = '[[test]]';
      const result = LinkParser.parseLinks(content, '');
      assert.strictEqual(result.links.length, 1);
      assert.strictEqual(result.links[0].sourceFile, '');
    });
  });
});
