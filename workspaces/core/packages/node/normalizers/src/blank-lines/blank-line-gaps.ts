import { attachedStart, statementLists } from '@mechane/modules';
import type { ListedStatement, ParsedSource } from '@mechane/modules';
import { Array } from 'effect';
import { isParted } from './is-parted.ts';

/** A blank line between two statements: a line break, a line of spaces at most, and another line break. */
const BLANK_LINE = /\n[ \t]*\n/;

type BlankLineGapsInput = { readonly source: ParsedSource };

/** Two neighbors of one list of statements, the first just before the second. */
type StatementPair = readonly [previous: ListedStatement, next: ListedStatement];

/**
 * The offsets where a file lacks a blank line between two neighbors of a block, a program, a switch case or a
 * namespace. Each is the start of the second's first line, its attached comment's when it has one. Two neighbors on one
 * line part at the end of the first, so the next run of the normalizer puts the blank line between them.
 */
export function blankLineGaps({ source }: BlankLineGapsInput): ReadonlyArray<number> {
  const { text, parsed } = source;

  /** Each pair of neighbors in a list. */
  const neighbors: (statements: ReadonlyArray<ListedStatement>) => ReadonlyArray<StatementPair> = (statements) => {
    const nexts = statements.slice(1);

    return Array.zip(statements, nexts);
  };

  const pairs = statementLists({ program: parsed.program }).flatMap(neighbors);

  /** The gap two neighbors leave when they need a blank line and lack one, before the second's attached comments. */
  const pairGaps: (pair: StatementPair) => ReadonlyArray<number> = ([previous, next]) => {
    if (!isParted({ previous, next, text })) {
      return [];
    }

    const start = attachedStart({ text, comments: parsed.comments, offset: next.start });
    const between = text.slice(previous.end, start);

    if (BLANK_LINE.test(between)) {
      return [];
    }

    const lineStart = text.lastIndexOf('\n', start) + 1;

    return [Math.max(lineStart, previous.end)];
  };

  return pairs.flatMap(pairGaps);
}
