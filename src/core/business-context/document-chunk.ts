export interface DocumentChunkDraft {
  chunkIndex: number;
  headingPath: string[];
  content: string;
  locator: { startChar: number; endChar: number };
}

interface Block {
  kind: 'heading' | 'paragraph';
  headingLevel: number | null;
  headingPath: string[];
  text: string;
  startChar: number;
  endChar: number;
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split('\n');
  const blocks: Block[] = [];
  const headingStack: { level: number; text: string }[] = [];

  let buf = '';
  let bufStart = 0;
  let charOffset = 0;
  let currentHeadingLevel: number | null = null;
  let currentHeadingPath: string[] = [];

  const flush = () => {
    const trimmed = buf.trimEnd();
    if (!trimmed) return;
    blocks.push({
      kind: currentHeadingLevel !== null ? 'heading' : 'paragraph',
      headingLevel: currentHeadingLevel,
      headingPath: [...currentHeadingPath],
      text: trimmed,
      startChar: bufStart,
      endChar: bufStart + trimmed.length,
    });
  };

  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.*)/);
    const lineEnd = charOffset + line.length;

    if (m) {
      // Flush previous block
      flush();

      const level = m[1].length;
      const text = m[2].trim();

      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      headingStack.push({ level, text });

      currentHeadingLevel = level;
      currentHeadingPath = headingStack.map(h => h.text);
      buf = line;
      bufStart = charOffset;
    } else if (line === '' && buf.trimEnd() !== '' && currentHeadingLevel === null) {
      // Blank line in paragraph content → flush paragraph, start new
      flush();
      buf = '';
      currentHeadingLevel = null;
      currentHeadingPath = [];
    } else {
      if (buf === '') {
        bufStart = charOffset;
        currentHeadingLevel = null;
        // Keep currentHeadingPath from last heading for inherited path
      }
      buf += (buf ? '\n' : '') + line;
    }

    charOffset = lineEnd + 1; // +1 for '\n'
  }

  flush();
  return blocks;
}

function mergeHeadingBlocks(blocks: Block[]): Block[] {
  // Merge a heading block with the immediately following paragraph block(s)
  const merged: Block[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    if (block.kind === 'heading') {
      // Collect following paragraph blocks (non-heading) until next heading
      let content = block.text;
      let endChar = block.endChar;
      let lastPath = block.headingPath;
      let j = i + 1;
      while (j < blocks.length && blocks[j].kind === 'paragraph') {
        content += '\n\n' + blocks[j].text;
        endChar = blocks[j].endChar;
        lastPath = blocks[j].headingPath.length > 0 ? blocks[j].headingPath : lastPath;
        j++;
      }
      merged.push({
        kind: 'heading',
        headingLevel: block.headingLevel,
        headingPath: block.headingPath,
        text: content,
        startChar: block.startChar,
        endChar,
      });
      i = j;
    } else {
      // Standalone paragraph (before any heading, or between heading groups)
      merged.push(block);
      i++;
    }
  }

  return merged;
}

function groupSegments(
  segments: Block[],
  maxChars: number
): { blocks: Block[]; splitByMaxChars: boolean }[] {
  if (segments.length === 0) return [];

  const groups: { blocks: Block[]; splitByMaxChars: boolean }[] = [];
  let current: Block[] = [segments[0]];
  let currentChars = segments[0].text.length;
  let deepestLevel = segments[0].headingLevel ?? 0;

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    const sepLen = 2;

    // Heading-level boundary: same or shallower heading starts new chunk
    if (seg.headingLevel !== null && seg.headingLevel <= deepestLevel) {
      groups.push({ blocks: current, splitByMaxChars: false });
      current = [seg];
      currentChars = seg.text.length;
      deepestLevel = seg.headingLevel;
      continue;
    }

    // MaxChars boundary
    if (currentChars + sepLen + seg.text.length > maxChars) {
      groups.push({ blocks: current, splitByMaxChars: true });
      current = [seg];
      currentChars = seg.text.length;
      if (seg.headingLevel !== null) deepestLevel = seg.headingLevel;
      continue;
    }

    // Add to current group
    current.push(seg);
    currentChars += sepLen + seg.text.length;
    if (seg.headingLevel !== null && seg.headingLevel > deepestLevel) {
      deepestLevel = seg.headingLevel;
    }
  }

  groups.push({ blocks: current, splitByMaxChars: false });
  return groups;
}

function buildChunks(
  groups: { blocks: Block[]; splitByMaxChars: boolean }[],
  maxChars: number,
  overlapChars: number
): DocumentChunkDraft[] {
  const chunks: DocumentChunkDraft[] = [];
  let chunkIndex = 0;

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    const content = group.blocks.map(b => b.text).join('\n\n');
    const startChar = group.blocks[0].startChar;
    const endChar = group.blocks[group.blocks.length - 1].endChar;

    // Oversized single block: split at character boundaries
    if (group.blocks.length === 1 && content.length > maxChars) {
      const block = group.blocks[0];
      let offset = 0;
      while (offset < content.length) {
        const end = Math.min(offset + maxChars, content.length);
        chunks.push({
          chunkIndex: chunkIndex++,
          headingPath: block.headingPath,
          content: content.slice(offset, end),
          locator: { startChar: block.startChar + offset, endChar: block.startChar + end },
        });
        if (end >= content.length) break;
        offset += maxChars - overlapChars;
        if (offset >= content.length) break;
      }
      continue;
    }

    // Normal chunk
    chunks.push({
      chunkIndex: chunkIndex++,
      headingPath: group.blocks[group.blocks.length - 1].headingPath,
      content,
      locator: { startChar, endChar },
    });

    // Add overlap to next group only when split was by maxChars (not heading boundary)
    if (g + 1 < groups.length && group.splitByMaxChars) {
      const overlapText = content.slice(-overlapChars);
      const overlapBlock: Block = {
        kind: 'paragraph',
        headingLevel: null,
        headingPath: group.blocks[group.blocks.length - 1].headingPath,
        text: overlapText,
        startChar: endChar - overlapChars,
        endChar,
      };
      groups[g + 1].blocks.unshift(overlapBlock);
    }
  }

  return chunks;
}

export function chunkMarkdown(
  markdown: string,
  options?: { maxChars?: number; overlapChars?: number }
): DocumentChunkDraft[] {
  if (!markdown) return [];

  const maxChars = options?.maxChars ?? 4000;
  const overlapChars = options?.overlapChars ?? 400;

  const blocks = parseBlocks(markdown);
  if (blocks.length === 0) return [];

  const segments = mergeHeadingBlocks(blocks);
  const groups = groupSegments(segments, maxChars);
  return buildChunks(groups, maxChars, overlapChars);
}
