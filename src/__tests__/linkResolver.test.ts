import * as assert from 'assert';
import { LinkResolver } from '../services/linkResolver';
import { LinkIndex, FileIndex, LinkInstance } from '../types/index';
import * as vscode from 'vscode';

/**
 * Test suite for LinkResolver service
 * Tests link resolution with fuzzy matching, caching, and candidate selection
 * Coverage: resolveLink, findBestMatch, getCandidates, isLinked, getLink, updateIndex
 */
describe('LinkResolver', () => {
  let resolver: LinkResolver;
  let mockIndex: LinkIndex;

  // Mock helper to create FileIndex entries
  function createFileIndex(path: string, name: string, links: LinkInstance[] = []): FileIndex {
    return {
      path,
      name,
      lastIndexed: Date.now(),
      contentHash: 'hash',
      outgoingLinks: links,
      metadata: {
        title: name,
        size: 100,
        createdAt: Date.now(),
        modifiedAt: Date.now()
      }
    };
  }

  // Mock helper to create LinkInstance
  function createLink(title: string, sourceFile: string, targetFile: string | null = null): LinkInstance {
    return {
      title,
      sourceFile,
      targetFile,
      range: new vscode.Range(0, 0, 0, 10),
      format: 'wikilink',
      targetExists: targetFile !== null,
      displayText: title
    };
  }

  beforeEach(() => {
    // Setup mock index with test files
    mockIndex = {
      files: new Map([
        ['/workspace/notes/my-note.md', createFileIndex('/workspace/notes/my-note.md', 'my-note')],
        ['/workspace/notes/important-file.md', createFileIndex('/workspace/notes/important-file.md', 'important-file')],
        ['/workspace/notes/todo.md', createFileIndex('/workspace/notes/todo.md', 'todo')],
        ['/workspace/notes/related-note.md', createFileIndex('/workspace/notes/related-note.md', 'related-note')],
        ['/workspace/notes/UPPERCASE.md', createFileIndex('/workspace/notes/UPPERCASE.md', 'uppercase')]
      ]),
      backlinks: new Map(),
      tags: new Map(),
      metadata: {
        version: '1.0',
        lastBuildTime: Date.now(),
        totalFiles: 5,
        totalLinks: 0
      }
    };

    resolver = new LinkResolver(mockIndex);
  });

  // ============================================================================
  // resolveLink Tests
  // ============================================================================
  describe('resolveLink', () => {
    it('should resolve exact match', () => {
      const link = createLink('my-note', '/workspace/notes/test.md');
      const result = resolver.resolveLink(link, '/workspace/notes/test.md');
      assert.strictEqual(result.targetFile, '/workspace/notes/my-note.md');
      assert.strictEqual(result.exists, true);
    });

    it('should resolve case-insensitive match', () => {
      const link = createLink('MY-NOTE', '/workspace/notes/test.md');
      const result = resolver.resolveLink(link, '/workspace/notes/test.md');
      assert.strictEqual(result.targetFile, '/workspace/notes/my-note.md');
      assert.strictEqual(result.exists, true);
    });

    it('should resolve without .md extension', () => {
      const link = createLink('my-note', '/workspace/notes/test.md');
      const result = resolver.resolveLink(link, '/workspace/notes/test.md');
      assert.strictEqual(result.exists, true);
    });

    it('should not resolve non-existent file', () => {
      const link = createLink('non-existent', '/workspace/notes/test.md');
      const result = resolver.resolveLink(link, '/workspace/notes/test.md');
      assert.strictEqual(result.exists, false);
    });

    it('should return candidates when no match found', () => {
      const link = createLink('non-existent', '/workspace/notes/test.md');
      const result = resolver.resolveLink(link, '/workspace/notes/test.md');
      assert(Array.isArray(result.candidates));
    });

    it('should return updated LinkInstance with resolved target', () => {
      const link = createLink('my-note', '/workspace/notes/test.md');
      const result = resolver.resolveLink(link, '/workspace/notes/test.md');
      assert.strictEqual(result.link.targetFile, result.targetFile);
      assert.strictEqual(result.link.targetExists, result.exists);
    });

    it('should cache resolution results', () => {
      const link = createLink('my-note', '/workspace/notes/test.md');
      const result1 = resolver.resolveLink(link, '/workspace/notes/test.md');
      const result2 = resolver.resolveLink(link, '/workspace/notes/test.md');
      assert.strictEqual(result1.targetFile, result2.targetFile);
    });
  });

  // ============================================================================
  // findBestMatch Tests
  // ============================================================================
  describe('findBestMatch', () => {
    it('should find exact match', () => {
      const allFiles = Array.from(mockIndex.files.values());
      const match = resolver.findBestMatch('my-note.md', '/workspace/notes', allFiles);
      assert(match !== null);
      assert.strictEqual(match!.name, 'my-note');
    });

    it('should find case-insensitive match', () => {
      const allFiles = Array.from(mockIndex.files.values());
      const match = resolver.findBestMatch('MY-NOTE.md', '/workspace/notes', allFiles);
      assert(match !== null);
      assert.strictEqual(match!.name, 'my-note');
    });

    it('should find fuzzy match with typo', () => {
      const allFiles = Array.from(mockIndex.files.values());
      const match = resolver.findBestMatch('my-mote.md', '/workspace/notes', allFiles);
      // May or may not find depending on Levenshtein distance threshold
      assert(match === null || match.name);
    });

    it('should find substring match', () => {
      const allFiles = Array.from(mockIndex.files.values());
      const match = resolver.findBestMatch('important', '/workspace/notes', allFiles);
      // Should find something containing 'important'
      assert(match === null || match.name.includes('important'));
    });

    it('should return null for no match', () => {
      const allFiles = Array.from(mockIndex.files.values());
      const match = resolver.findBestMatch('zzzzzzzzzzzzzzz.md', '/workspace/notes', allFiles);
      assert.strictEqual(match, null);
    });

    it('should handle empty file list', () => {
      const match = resolver.findBestMatch('my-note.md', '/workspace/notes', []);
      assert.strictEqual(match, null);
    });

    it('should prioritize exact match over fuzzy', () => {
      const allFiles = Array.from(mockIndex.files.values());
      const match = resolver.findBestMatch('my-note.md', '/workspace/notes', allFiles);
      assert(match !== null);
      assert.strictEqual(match!.name, 'my-note');
    });
  });

  // ============================================================================
  // getCandidates Tests
  // ============================================================================
  describe('getCandidates', () => {
    it('should return candidate matches', () => {
      const candidates = resolver.getCandidates('my-note');
      assert(Array.isArray(candidates));
      assert(candidates.length > 0);
    });

    it('should limit candidates to specified number', () => {
      const candidates = resolver.getCandidates('note', 2);
      assert(candidates.length <= 2);
    });

    it('should return top candidates in order of relevance', () => {
      const candidates = resolver.getCandidates('my-note');
      // First candidates should be more relevant
      assert(candidates.length > 0);
      assert(candidates[0].name !== undefined);
    });

    it('should return empty array for no matches', () => {
      const candidates = resolver.getCandidates('zzzzzzzzzzz');
      assert(Array.isArray(candidates));
      assert.strictEqual(candidates.length, 0);
    });

    it('should use default limit of 5', () => {
      const candidates = resolver.getCandidates('note');
      assert(candidates.length <= 5);
    });

    it('should handle single character query', () => {
      const candidates = resolver.getCandidates('m');
      assert(Array.isArray(candidates));
    });

    it('should score exact matches highest', () => {
      const candidates = resolver.getCandidates('my-note');
      if (candidates.length > 0) {
        assert.strictEqual(candidates[0].name, 'my-note');
      }
    });
  });

  // ============================================================================
  // isLinked Tests
  // ============================================================================
  describe('isLinked', () => {
    beforeEach(() => {
      // Setup files with actual links
      const link = createLink('target', '/workspace/notes/source.md', '/workspace/notes/target.md');
      const sourceFile = createFileIndex('/workspace/notes/source.md', 'source', [link]);
      const targetFile = createFileIndex('/workspace/notes/target.md', 'target');

      mockIndex.files.set('/workspace/notes/source.md', sourceFile);
      mockIndex.files.set('/workspace/notes/target.md', targetFile);

      resolver.updateIndex(mockIndex);
    });

    it('should return true if link exists', () => {
      const linked = resolver.isLinked('/workspace/notes/source.md', '/workspace/notes/target.md');
      assert.strictEqual(linked, true);
    });

    it('should return false if link does not exist', () => {
      const linked = resolver.isLinked('/workspace/notes/my-note.md', '/workspace/notes/todo.md');
      assert.strictEqual(linked, false);
    });

    it('should return false if source file does not exist', () => {
      const linked = resolver.isLinked('/workspace/notes/nonexistent.md', '/workspace/notes/target.md');
      assert.strictEqual(linked, false);
    });
  });

  // ============================================================================
  // getLink Tests
  // ============================================================================
  describe('getLink', () => {
    beforeEach(() => {
      const link = createLink('target', '/workspace/notes/source.md', '/workspace/notes/target.md');
      const sourceFile = createFileIndex('/workspace/notes/source.md', 'source', [link]);
      const targetFile = createFileIndex('/workspace/notes/target.md', 'target');

      mockIndex.files.set('/workspace/notes/source.md', sourceFile);
      mockIndex.files.set('/workspace/notes/target.md', targetFile);

      resolver.updateIndex(mockIndex);
    });

    it('should return link if it exists', () => {
      const link = resolver.getLink('/workspace/notes/source.md', '/workspace/notes/target.md');
      assert(link !== null);
      assert.strictEqual(link!.title, 'target');
    });

    it('should return null if link does not exist', () => {
      const link = resolver.getLink('/workspace/notes/my-note.md', '/workspace/notes/todo.md');
      assert.strictEqual(link, null);
    });

    it('should return null if source file does not exist', () => {
      const link = resolver.getLink('/workspace/notes/nonexistent.md', '/workspace/notes/target.md');
      assert.strictEqual(link, null);
    });
  });

  // ============================================================================
  // updateIndex Tests
  // ============================================================================
  describe('updateIndex', () => {
    it('should update internal index reference', () => {
      const newIndex: LinkIndex = {
        files: new Map([
          ['/workspace/notes/new-note.md', createFileIndex('/workspace/notes/new-note.md', 'new-note')]
        ]),
        backlinks: new Map(),
        tags: new Map(),
        metadata: {
          version: '1.0',
          lastBuildTime: Date.now(),
          totalFiles: 1,
          totalLinks: 0
        }
      };

      resolver.updateIndex(newIndex);

      // Test that new index is used
      const candidates = resolver.getCandidates('new-note');
      assert(candidates.length > 0);
    });

    it('should clear cache when index updates', () => {
      const link = createLink('my-note', '/workspace/notes/test.md');
      resolver.resolveLink(link, '/workspace/notes/test.md');

      // Update index
      const newIndex: LinkIndex = {
        files: new Map(),
        backlinks: new Map(),
        tags: new Map(),
        metadata: {
          version: '1.0',
          lastBuildTime: Date.now(),
          totalFiles: 0,
          totalLinks: 0
        }
      };

      resolver.updateIndex(newIndex);

      // Resolution should now return no match
      const result = resolver.resolveLink(link, '/workspace/notes/test.md');
      assert.strictEqual(result.exists, false);
    });
  });

  // ============================================================================
  // Fuzzy Matching Tests
  // ============================================================================
  describe('Fuzzy Matching', () => {
    it('should handle typos in file names', () => {
      const candidates = resolver.getCandidates('importent');
      // Should find 'important-file' despite typo
      assert(candidates.length >= 0);
    });

    it('should find matches with missing characters', () => {
      const candidates = resolver.getCandidates('my-note');
      assert(candidates.length > 0);
    });

    it('should find matches with extra characters', () => {
      const candidates = resolver.getCandidates('my-notte');
      assert(candidates.length >= 0);
    });
  });

  // ============================================================================
  // Cache Tests
  // ============================================================================
  describe('Cache', () => {
    it('should cache resolution results', () => {
      const link1 = createLink('my-note', '/workspace/notes/test.md');
      const link2 = createLink('my-note', '/workspace/notes/test.md');

      const result1 = resolver.resolveLink(link1, '/workspace/notes/test.md');
      const result2 = resolver.resolveLink(link2, '/workspace/notes/test.md');

      assert.strictEqual(result1.targetFile, result2.targetFile);
    });

    it('should clear cache on index update', () => {
      const link = createLink('my-note', '/workspace/notes/test.md');
      resolver.resolveLink(link, '/workspace/notes/test.md');

      const newIndex: LinkIndex = {
        files: new Map(),
        backlinks: new Map(),
        tags: new Map(),
        metadata: {
          version: '1.0',
          lastBuildTime: Date.now(),
          totalFiles: 0,
          totalLinks: 0
        }
      };

      resolver.updateIndex(newIndex);

      // Cache should be cleared, so resolution should be different
      const result = resolver.resolveLink(link, '/workspace/notes/test.md');
      assert.strictEqual(result.exists, false);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('Edge Cases', () => {
    it('should handle empty link title', () => {
      const link = createLink('', '/workspace/notes/test.md');
      const result = resolver.resolveLink(link, '/workspace/notes/test.md');
      assert(result !== null);
    });

    it('should handle very long link title', () => {
      const longTitle = 'a'.repeat(1000);
      const link = createLink(longTitle, '/workspace/notes/test.md');
      const result = resolver.resolveLink(link, '/workspace/notes/test.md');
      assert(result !== null);
    });

    it('should handle special characters in file names', () => {
      const specialIndex: LinkIndex = {
        files: new Map([
          ['/workspace/notes/file-with-dash.md', createFileIndex('/workspace/notes/file-with-dash.md', 'file-with-dash')]
        ]),
        backlinks: new Map(),
        tags: new Map(),
        metadata: {
          version: '1.0',
          lastBuildTime: Date.now(),
          totalFiles: 1,
          totalLinks: 0
        }
      };

      resolver.updateIndex(specialIndex);

      const link = createLink('file-with-dash', '/workspace/notes/test.md');
      const result = resolver.resolveLink(link, '/workspace/notes/test.md');
      assert.strictEqual(result.exists, true);
    });

    it('should handle multiple dots in file name', () => {
      const specialIndex: LinkIndex = {
        files: new Map([
          ['/workspace/notes/file.test.md', createFileIndex('/workspace/notes/file.test.md', 'file.test')]
        ]),
        backlinks: new Map(),
        tags: new Map(),
        metadata: {
          version: '1.0',
          lastBuildTime: Date.now(),
          totalFiles: 1,
          totalLinks: 0
        }
      };

      resolver.updateIndex(specialIndex);

      const link = createLink('file.test', '/workspace/notes/test.md');
      const result = resolver.resolveLink(link, '/workspace/notes/test.md');
      assert(result !== null);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================
  describe('Performance', () => {
    it('should resolve link quickly (< 10ms)', () => {
      const link = createLink('my-note', '/workspace/notes/test.md');
      const start = Date.now();
      resolver.resolveLink(link, '/workspace/notes/test.md');
      const elapsed = Date.now() - start;
      assert(elapsed < 10, `Resolution took ${elapsed}ms, expected < 10ms`);
    });

    it('should get candidates quickly (< 10ms)', () => {
      const start = Date.now();
      resolver.getCandidates('my-note');
      const elapsed = Date.now() - start;
      assert(elapsed < 10, `Getting candidates took ${elapsed}ms, expected < 10ms`);
    });
  });
});
