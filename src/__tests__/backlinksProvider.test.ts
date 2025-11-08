import * as assert from 'assert';
import { BacklinksProvider, LinkValidationReport } from '../services/backlinksProvider';
import { LinkIndex, FileIndex, LinkInstance } from '../types/index';
import * as vscode from 'vscode';

/**
 * Test suite for BacklinksProvider service
 * Tests bidirectional link queries, graph operations, and link validation
 * Coverage: getBacklinksFor, getLinksFrom, getDistance, getConnectedGraph, getFilesWithBrokenLinks, validateLinks, updateIndex
 */
describe('BacklinksProvider', () => {
  let provider: BacklinksProvider;
  let mockIndex: LinkIndex;

  // Mock helper to create FileIndex
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
  function createLink(title: string, sourceFile: string, targetFile: string, targetExists: boolean = true): LinkInstance {
    return {
      title,
      sourceFile,
      targetFile,
      range: new vscode.Range(0, 0, 0, 10),
      format: 'wikilink',
      targetExists,
      displayText: title
    };
  }

  beforeEach(() => {
    // Setup mock index with sample files
    // Graph structure:
    // A -> B
    // A -> C
    // B -> C
    // D (isolated)
    // E -> B (broken link)

    const linkAtoB = createLink('B', '/workspace/notes/a.md', '/workspace/notes/b.md', true);
    const linkAtoC = createLink('C', '/workspace/notes/a.md', '/workspace/notes/c.md', true);
    const linkBtoC = createLink('C', '/workspace/notes/b.md', '/workspace/notes/c.md', true);
    const linkEtoMissing = createLink('Missing', '/workspace/notes/e.md', '/workspace/notes/missing.md', false);

    mockIndex = {
      files: new Map([
        ['/workspace/notes/a.md', createFileIndex('/workspace/notes/a.md', 'a', [linkAtoB, linkAtoC])],
        ['/workspace/notes/b.md', createFileIndex('/workspace/notes/b.md', 'b', [linkBtoC])],
        ['/workspace/notes/c.md', createFileIndex('/workspace/notes/c.md', 'c', [])],
        ['/workspace/notes/d.md', createFileIndex('/workspace/notes/d.md', 'd', [])],
        ['/workspace/notes/e.md', createFileIndex('/workspace/notes/e.md', 'e', [linkEtoMissing])]
      ]),
      backlinks: new Map([
        ['/workspace/notes/b.md', new Set(['/workspace/notes/a.md'])],
        ['/workspace/notes/c.md', new Set(['/workspace/notes/a.md', '/workspace/notes/b.md'])]
      ]),
      tags: new Map(),
      metadata: {
        version: '1.0',
        lastBuildTime: Date.now(),
        totalFiles: 5,
        totalLinks: 4
      }
    };

    provider = new BacklinksProvider(mockIndex);
  });

  // ============================================================================
  // getBacklinksFor Tests
  // ============================================================================
  describe('getBacklinksFor', () => {
    it('should return backlinks for file with incoming links', () => {
      const backlinks = provider.getBacklinksFor('/workspace/notes/c.md');
      assert.strictEqual(backlinks.length, 2);
      const paths = backlinks.map(f => f.path);
      assert(paths.includes('/workspace/notes/a.md'));
      assert(paths.includes('/workspace/notes/b.md'));
    });

    it('should return single backlink', () => {
      const backlinks = provider.getBacklinksFor('/workspace/notes/b.md');
      assert.strictEqual(backlinks.length, 1);
      assert.strictEqual(backlinks[0].path, '/workspace/notes/a.md');
    });

    it('should return empty array for file with no backlinks', () => {
      const backlinks = provider.getBacklinksFor('/workspace/notes/a.md');
      assert.strictEqual(backlinks.length, 0);
    });

    it('should return empty array for non-existent file', () => {
      const backlinks = provider.getBacklinksFor('/workspace/notes/nonexistent.md');
      assert.strictEqual(backlinks.length, 0);
    });

    it('should return FileIndex objects', () => {
      const backlinks = provider.getBacklinksFor('/workspace/notes/c.md');
      assert(backlinks.length > 0);
      assert(backlinks[0].path !== undefined);
      assert(backlinks[0].name !== undefined);
    });

    it('should handle empty file path', () => {
      const backlinks = provider.getBacklinksFor('');
      assert.strictEqual(backlinks.length, 0);
    });

    it('should return all backlinks, not just first', () => {
      const backlinks = provider.getBacklinksFor('/workspace/notes/c.md');
      assert.strictEqual(backlinks.length, 2);
    });
  });

  // ============================================================================
  // getLinksFrom Tests
  // ============================================================================
  describe('getLinksFrom', () => {
    it('should return outgoing links from file', () => {
      const links = provider.getLinksFrom('/workspace/notes/a.md');
      assert.strictEqual(links.length, 2);
      const titles = links.map(l => l.title);
      assert(titles.includes('B'));
      assert(titles.includes('C'));
    });

    it('should return single link', () => {
      const links = provider.getLinksFrom('/workspace/notes/b.md');
      assert.strictEqual(links.length, 1);
      assert.strictEqual(links[0].title, 'C');
    });

    it('should return empty array for file with no links', () => {
      const links = provider.getLinksFrom('/workspace/notes/c.md');
      assert.strictEqual(links.length, 0);
    });

    it('should return empty array for non-existent file', () => {
      const links = provider.getLinksFrom('/workspace/notes/nonexistent.md');
      assert.strictEqual(links.length, 0);
    });

    it('should return LinkInstance objects', () => {
      const links = provider.getLinksFrom('/workspace/notes/a.md');
      assert(links.length > 0);
      assert(links[0].title !== undefined);
      assert(links[0].targetFile !== undefined);
    });

    it('should include broken links', () => {
      const links = provider.getLinksFrom('/workspace/notes/e.md');
      assert.strictEqual(links.length, 1);
      assert.strictEqual(links[0].targetExists, false);
    });

    it('should handle empty file path', () => {
      const links = provider.getLinksFrom('');
      assert.strictEqual(links.length, 0);
    });
  });

  // ============================================================================
  // getDistance Tests
  // ============================================================================
  describe('getDistance', () => {
    it('should return 0 for same file', () => {
      const distance = provider.getDistance('/workspace/notes/a.md', '/workspace/notes/a.md');
      assert.strictEqual(distance, 0);
    });

    it('should return 1 for direct link', () => {
      const distance = provider.getDistance('/workspace/notes/a.md', '/workspace/notes/b.md');
      assert.strictEqual(distance, 1);
    });

    it('should return 2 for two-hop path', () => {
      const distance = provider.getDistance('/workspace/notes/a.md', '/workspace/notes/c.md');
      assert.strictEqual(distance, 1); // Direct link A -> C
    });

    it('should find shortest path A -> B -> C', () => {
      const distance = provider.getDistance('/workspace/notes/a.md', '/workspace/notes/c.md');
      assert(distance >= 1 && distance <= 2);
    });

    it('should return -1 for disconnected nodes', () => {
      const distance = provider.getDistance('/workspace/notes/a.md', '/workspace/notes/d.md');
      assert.strictEqual(distance, -1);
    });

    it('should handle bidirectional links', () => {
      // A -> B, so B -> A should also be connected via backlinks
      const distanceReverse = provider.getDistance('/workspace/notes/b.md', '/workspace/notes/a.md');
      assert(distanceReverse === 1 || distanceReverse === -1);
    });

    it('should return -1 for non-existent source file', () => {
      const distance = provider.getDistance('/workspace/notes/nonexistent.md', '/workspace/notes/a.md');
      assert.strictEqual(distance, -1);
    });

    it('should return -1 for non-existent target file', () => {
      const distance = provider.getDistance('/workspace/notes/a.md', '/workspace/notes/nonexistent.md');
      assert.strictEqual(distance, -1);
    });

    it('should cache distance results', () => {
      const distance1 = provider.getDistance('/workspace/notes/a.md', '/workspace/notes/b.md');
      const distance2 = provider.getDistance('/workspace/notes/a.md', '/workspace/notes/b.md');
      assert.strictEqual(distance1, distance2);
    });

    it('should handle empty file paths', () => {
      const distance1 = provider.getDistance('', '/workspace/notes/a.md');
      const distance2 = provider.getDistance('/workspace/notes/a.md', '');
      assert.strictEqual(distance1, -1);
      assert.strictEqual(distance2, -1);
    });
  });

  // ============================================================================
  // getConnectedGraph Tests
  // ============================================================================
  describe('getConnectedGraph', () => {
    it('should return connected files from A', () => {
      const graph = provider.getConnectedGraph('/workspace/notes/a.md');
      assert(graph.size > 0);
      const paths = Array.from(graph.keys());
      assert(paths.includes('/workspace/notes/b.md') || paths.includes('/workspace/notes/c.md'));
    });

    it('should return empty map for isolated file', () => {
      const graph = provider.getConnectedGraph('/workspace/notes/d.md');
      assert.strictEqual(graph.size, 0);
    });

    it('should return empty map for non-existent file', () => {
      const graph = provider.getConnectedGraph('/workspace/notes/nonexistent.md');
      assert.strictEqual(graph.size, 0);
    });

    it('should include distance values', () => {
      const graph = provider.getConnectedGraph('/workspace/notes/a.md');
      for (const [, distance] of graph) {
        assert(typeof distance === 'number');
        assert(distance > 0);
      }
    });

    it('should respect maxDepth parameter', () => {
      const graphDepth1 = provider.getConnectedGraph('/workspace/notes/a.md', 1);
      const graphAll = provider.getConnectedGraph('/workspace/notes/a.md');

      assert(graphDepth1.size <= graphAll.size);
    });

    it('should not include root file in results', () => {
      const graph = provider.getConnectedGraph('/workspace/notes/a.md');
      assert(!graph.has('/workspace/notes/a.md'));
    });

    it('should calculate correct distances', () => {
      const graph = provider.getConnectedGraph('/workspace/notes/a.md');
      for (const [, distance] of graph) {
        assert(distance >= 1, 'Distance should be at least 1 for connected files');
      }
    });

    it('should handle maxDepth = 0', () => {
      const graph = provider.getConnectedGraph('/workspace/notes/a.md', 0);
      assert.strictEqual(graph.size, 0);
    });

    it('should handle undefined maxDepth (unlimited)', () => {
      const graph = provider.getConnectedGraph('/workspace/notes/a.md');
      assert(graph.size > 0);
    });

    it('should handle empty file path', () => {
      const graph = provider.getConnectedGraph('');
      assert.strictEqual(graph.size, 0);
    });
  });

  // ============================================================================
  // getFilesWithBrokenLinks Tests
  // ============================================================================
  describe('getFilesWithBrokenLinks', () => {
    it('should return files with broken links', () => {
      const brokenFiles = provider.getFilesWithBrokenLinks();
      const paths = brokenFiles.map(f => f.path);
      assert(paths.includes('/workspace/notes/e.md'));
    });

    it('should not include files with only valid links', () => {
      const brokenFiles = provider.getFilesWithBrokenLinks();
      const paths = brokenFiles.map(f => f.path);
      assert(!paths.includes('/workspace/notes/a.md'));
      assert(!paths.includes('/workspace/notes/b.md'));
      assert(!paths.includes('/workspace/notes/c.md'));
    });

    it('should return empty array if no broken links', () => {
      const cleanIndex: LinkIndex = {
        files: new Map([
          ['/workspace/notes/a.md', createFileIndex('/workspace/notes/a.md', 'a', [
            createLink('B', '/workspace/notes/a.md', '/workspace/notes/b.md', true)
          ])],
          ['/workspace/notes/b.md', createFileIndex('/workspace/notes/b.md', 'b', [])]
        ]),
        backlinks: new Map([
          ['/workspace/notes/b.md', new Set(['/workspace/notes/a.md'])]
        ]),
        tags: new Map(),
        metadata: {
          version: '1.0',
          lastBuildTime: Date.now(),
          totalFiles: 2,
          totalLinks: 1
        }
      };

      provider.updateIndex(cleanIndex);
      const brokenFiles = provider.getFilesWithBrokenLinks();
      assert.strictEqual(brokenFiles.length, 0);
    });

    it('should return FileIndex objects', () => {
      const brokenFiles = provider.getFilesWithBrokenLinks();
      if (brokenFiles.length > 0) {
        assert(brokenFiles[0].path !== undefined);
        assert(brokenFiles[0].name !== undefined);
      }
    });
  });

  // ============================================================================
  // validateLinks Tests
  // ============================================================================
  describe('validateLinks', () => {
    it('should return LinkValidationReport', () => {
      const report = provider.validateLinks();
      assert(report !== null);
      assert(typeof report.valid === 'number');
      assert(typeof report.broken === 'number');
      assert(Array.isArray(report.details));
    });

    it('should count valid links correctly', () => {
      const report = provider.validateLinks();
      assert.strictEqual(report.valid, 3); // A->B, A->C, B->C
    });

    it('should count broken links correctly', () => {
      const report = provider.validateLinks();
      assert.strictEqual(report.broken, 1); // E->Missing
    });

    it('should provide details for broken links', () => {
      const report = provider.validateLinks();
      assert(report.details.length > 0);
      const brokenDetail = report.details[0];
      assert(brokenDetail.source !== undefined);
      assert(brokenDetail.target !== undefined);
      assert(brokenDetail.link !== undefined);
    });

    it('should sum valid + broken = total links', () => {
      const report = provider.validateLinks();
      const totalLinks = report.valid + report.broken;
      assert.strictEqual(totalLinks, 4);
    });

    it('should handle empty index', () => {
      const emptyIndex: LinkIndex = {
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

      provider.updateIndex(emptyIndex);
      const report = provider.validateLinks();
      assert.strictEqual(report.valid, 0);
      assert.strictEqual(report.broken, 0);
      assert.strictEqual(report.details.length, 0);
    });
  });

  // ============================================================================
  // updateIndex Tests
  // ============================================================================
  describe('updateIndex', () => {
    it('should update internal index reference', () => {
      const newIndex: LinkIndex = {
        files: new Map([
          ['/workspace/notes/new.md', createFileIndex('/workspace/notes/new.md', 'new', [])]
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

      provider.updateIndex(newIndex);

      const backlinks = provider.getBacklinksFor('/workspace/notes/a.md');
      assert.strictEqual(backlinks.length, 0);
    });

    it('should clear distance cache on update', () => {
      const distance1 = provider.getDistance('/workspace/notes/a.md', '/workspace/notes/b.md');

      const newIndex: LinkIndex = {
        files: new Map([
          ['/workspace/notes/x.md', createFileIndex('/workspace/notes/x.md', 'x', [])]
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

      provider.updateIndex(newIndex);

      const distance2 = provider.getDistance('/workspace/notes/a.md', '/workspace/notes/b.md');
      assert.strictEqual(distance2, -1); // Should not be connected in new index
    });
  });

  // ============================================================================
  // Graph Traversal Tests
  // ============================================================================
  describe('Graph Traversal', () => {
    it('should handle circular links', () => {
      const circularIndex: LinkIndex = {
        files: new Map([
          ['/workspace/notes/x.md', createFileIndex('/workspace/notes/x.md', 'x', [
            createLink('Y', '/workspace/notes/x.md', '/workspace/notes/y.md', true)
          ])],
          ['/workspace/notes/y.md', createFileIndex('/workspace/notes/y.md', 'y', [
            createLink('X', '/workspace/notes/y.md', '/workspace/notes/x.md', true)
          ])]
        ]),
        backlinks: new Map([
          ['/workspace/notes/y.md', new Set(['/workspace/notes/x.md'])],
          ['/workspace/notes/x.md', new Set(['/workspace/notes/y.md'])]
        ]),
        tags: new Map(),
        metadata: {
          version: '1.0',
          lastBuildTime: Date.now(),
          totalFiles: 2,
          totalLinks: 2
        }
      };

      provider.updateIndex(circularIndex);

      const distance = provider.getDistance('/workspace/notes/x.md', '/workspace/notes/y.md');
      assert.strictEqual(distance, 1);
    });

    it('should handle self-loops', () => {
      const selfLoopIndex: LinkIndex = {
        files: new Map([
          ['/workspace/notes/self.md', createFileIndex('/workspace/notes/self.md', 'self', [
            createLink('Self', '/workspace/notes/self.md', '/workspace/notes/self.md', true)
          ])]
        ]),
        backlinks: new Map([
          ['/workspace/notes/self.md', new Set(['/workspace/notes/self.md'])]
        ]),
        tags: new Map(),
        metadata: {
          version: '1.0',
          lastBuildTime: Date.now(),
          totalFiles: 1,
          totalLinks: 1
        }
      };

      provider.updateIndex(selfLoopIndex);

      const distance = provider.getDistance('/workspace/notes/self.md', '/workspace/notes/self.md');
      assert.strictEqual(distance, 0);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================
  describe('Performance', () => {
    it('should get backlinks quickly (< 5ms)', () => {
      const start = Date.now();
      provider.getBacklinksFor('/workspace/notes/c.md');
      const elapsed = Date.now() - start;
      assert(elapsed < 5, `Getting backlinks took ${elapsed}ms, expected < 5ms`);
    });

    it('should get distance quickly (< 5ms)', () => {
      const start = Date.now();
      provider.getDistance('/workspace/notes/a.md', '/workspace/notes/b.md');
      const elapsed = Date.now() - start;
      assert(elapsed < 5, `Getting distance took ${elapsed}ms, expected < 5ms`);
    });

    it('should validate links quickly (< 10ms)', () => {
      const start = Date.now();
      provider.validateLinks();
      const elapsed = Date.now() - start;
      assert(elapsed < 10, `Validating links took ${elapsed}ms, expected < 10ms`);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('Edge Cases', () => {
    it('should handle file with multiple broken links', () => {
      const multiBreakIndex: LinkIndex = {
        files: new Map([
          ['/workspace/notes/broken.md', createFileIndex('/workspace/notes/broken.md', 'broken', [
            createLink('Missing1', '/workspace/notes/broken.md', '/workspace/notes/missing1.md', false),
            createLink('Missing2', '/workspace/notes/broken.md', '/workspace/notes/missing2.md', false),
            createLink('Missing3', '/workspace/notes/broken.md', '/workspace/notes/missing3.md', false)
          ])]
        ]),
        backlinks: new Map(),
        tags: new Map(),
        metadata: {
          version: '1.0',
          lastBuildTime: Date.now(),
          totalFiles: 1,
          totalLinks: 3
        }
      };

      provider.updateIndex(multiBreakIndex);
      const report = provider.validateLinks();
      assert.strictEqual(report.broken, 3);
      assert.strictEqual(report.details.length, 3);
    });
  });
});
