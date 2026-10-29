import { Array, Option } from 'effect';
import type { Block } from './types.ts';

/** A fenced code block, up to its closing fence or the end of the document. */
const CODE_BLOCK = /^```[\s\S]*?(?:^```.*|(?![\s\S]))/gmu;

/** A character of a code block other than its line breaks, which the blocks blank so line numbers hold. */
const CODE_CHARACTER = /[^\n]/gu;

/** A line of prose: one that opens with text, not a heading, a table row or a comment. */
const PROSE_LINE = /^\s*[^\s#|<]/u;

/** A line that opens a list item, such as `- item` or `1. item`. */
const LIST_ITEM = /^\s*([-*]|\d+\.)\s/u;

type BlocksInput = { readonly text: string };

/** The blocks so far, and the next line of the document with its number. */
type BlocksAfterInput = { readonly blocks: ReadonlyArray<Block>; readonly line: string; readonly lineNumber: number };

/** The paragraphs and list items of a Markdown document, outside code blocks, headings, tables and comments. */
export function proseBlocks({ text }: BlocksInput): ReadonlyArray<Block> {
  const lines = text.replaceAll(CODE_BLOCK, (code) => code.replaceAll(CODE_CHARACTER, '')).split('\n');
  let blocks: ReadonlyArray<Block> = [];

  for (const [index, line] of lines.entries()) {
    blocks = blocksAfter({ blocks, line, lineNumber: index + 1 });
  }

  return blocks.filter((block) => block.text !== '');
}

/**
 * The blocks once the next line is read. A line that is not prose closes the block before it, and a list item or the
 * first line after a closed block opens one. Any other line joins the open block.
 */
function blocksAfter({ blocks, line, lineNumber }: BlocksAfterInput): ReadonlyArray<Block> {
  const previous = Array.last(blocks);
  const isListItem = LIST_ITEM.test(line);

  if (!PROSE_LINE.test(line)) {
    return [...blocks, { line: lineNumber, text: '', isListItem: false }];
  }

  if (isListItem || Option.isNone(previous) || previous.value.text === '') {
    return [...blocks, { line: lineNumber, text: line.trim(), isListItem }];
  }

  return [...Array.dropRight(blocks, 1), { ...previous.value, text: `${previous.value.text} ${line.trim()}` }];
}
