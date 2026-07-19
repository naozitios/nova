import { describe, expect, it } from 'vitest';
import { chunkMarkdown } from './document-chunk';

describe('chunkMarkdown', () => {
  it('returns empty array for empty input', () => {
    expect(chunkMarkdown('')).toEqual([]);
  });

  it('single paragraph returns one chunk with correct locator', () => {
    const md = 'Hello world.';
    const chunks = chunkMarkdown(md);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('Hello world.');
    expect(chunks[0].locator).toEqual({ startChar: 0, endChar: 12 });
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it('headings remain attached to following content', () => {
    const md = '# Title\n\nParagraph under title.';
    const chunks = chunkMarkdown(md);
    expect(chunks[0].content).toContain('# Title');
    expect(chunks[0].content).toContain('Paragraph under title.');
  });

  it('assigns sequential chunkIndex [0, 1, 2, ...]', () => {
    const md = 'A'.repeat(5000);
    const chunks = chunkMarkdown(md);
    expect(chunks.map(c => c.chunkIndex)).toEqual([0, 1]);
  });

  it('no chunk exceeds 4000 chars except one indivisible paragraph', () => {
    const md = [
      '# Title',
      '',
      'A'.repeat(1000),
      '',
      'B'.repeat(1000),
      '',
      'C'.repeat(1000),
      '',
      'D'.repeat(1000),
      '',
      'E'.repeat(1000),
    ].join('\n');
    const chunks = chunkMarkdown(md);
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(4000);
    }
  });

  it('overlap is at most 400 chars between consecutive chunks', () => {
    const md = [
      'A'.repeat(2000),
      '',
      'B'.repeat(2000),
      '',
      'C'.repeat(2000),
      '',
      'D'.repeat(2000),
    ].join('\n');
    const chunks = chunkMarkdown(md);
    for (let i = 0; i < chunks.length - 1; i++) {
      const curr = chunks[i].content;
      const next = chunks[i + 1].content;
      // Overlap is the suffix of curr that matches prefix of next
      let overlapLen = 0;
      for (let k = 1; k <= Math.min(curr.length, next.length); k++) {
        if (curr.endsWith(next.slice(0, k))) {
          overlapLen = k;
        }
      }
      if (overlapLen > 0) {
        expect(overlapLen).toBeLessThanOrEqual(400);
      }
    }
  });

  it('produces deterministic output (deeply equal)', () => {
    const md = '# Title\n\nParagraph one.\n\n## Section\n\nParagraph two.';
    const a = chunkMarkdown(md);
    const b = chunkMarkdown(md);
    expect(a).toEqual(b);
  });

  it('heading path tracks nesting (h1 → h2 → h3)', () => {
    const md = '# H1\n\n## H2\n\n### H3\n\nContent here.';
    const chunks = chunkMarkdown(md);
    expect(chunks[0].headingPath).toEqual(['H1', 'H2', 'H3']);
  });

  it('locator startChar/endChar are correct offsets', () => {
    const md = '# Title\n\nBody text here.';
    const chunks = chunkMarkdown(md);
    expect(chunks[0].locator.startChar).toBe(0);
    expect(chunks[0].locator.endChar).toBe(md.length);
  });

  it('correct heading path when heading level decreases', () => {
    const md = '# H1\n\n## H2a\n\nContent A\n\n## H2b\n\nContent B';
    const chunks = chunkMarkdown(md);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].headingPath).toEqual(['H1', 'H2a']);
    expect(chunks[1].headingPath).toEqual(['H1', 'H2b']);
  });
});
