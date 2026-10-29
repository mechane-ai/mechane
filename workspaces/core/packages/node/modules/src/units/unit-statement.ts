import { Array, Option } from 'effect';
import type { Comment } from 'oxc-parser';
import { lineEnd } from '../line-end.ts';
import type { TopLevelDeclaration, UnitStatement } from '../types.ts';
import { attachedStart } from './attached-start.ts';

/** The text between a statement and a comment after it on its own line, which the comment's move takes along. */
const SAME_LINE_GAP = /^[ \t]*$/;

/** A file's text and comments, and a statement and the declaration it holds. */
type UnitStatementInput = {
  readonly text: string;
  readonly comments: ReadonlyArray<Comment>;
  readonly entry: TopLevelDeclaration;
};

/** A file's text and comments, and the offset where a statement ends. */
type TrailingEndInput = { readonly text: string; readonly comments: ReadonlyArray<Comment>; readonly offset: number };

/** A statement's span with its attached comments and its line, and its text with and without its `export`. */
export function unitStatement({ text, comments, entry }: UnitStatementInput): UnitStatement {
  const start = attachedStart({ text, comments, offset: entry.statement.start });
  const trailing = trailingEnd({ text, comments, offset: entry.statement.end });

  return {
    start,
    end: lineEnd({ text, offset: trailing }),
    text: text.slice(start, trailing),
    privateText: `${text.slice(start, entry.statement.start)}${text.slice(entry.declaration.start, trailing)}`,
  };
}

/** Where a statement ends with the comment that follows it on its line. */
function trailingEnd({ text, comments, offset }: TrailingEndInput): number {
  const next = Array.findFirst(comments, ({ start }) => start >= offset);

  if (Option.isSome(next) && SAME_LINE_GAP.test(text.slice(offset, next.value.start))) {
    return next.value.end;
  }

  return offset;
}
