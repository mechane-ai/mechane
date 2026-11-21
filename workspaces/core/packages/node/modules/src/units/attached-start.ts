import { Array, Option } from 'effect';
import type { Comment } from 'oxc-parser';

/** The text between a comment and the statement below it that keeps the comment attached: at most one line break. */
const ATTACHED_GAP = /^[ \t]*\n?[ \t]*$/;

/** A file's text and comments, and the offset where a statement starts. */
type AttachedStartInput = { readonly text: string; readonly comments: ReadonlyArray<Comment>; readonly offset: number };

/** Where a statement's attached comments start: each comment on its own line just above, with no blank line between. */
export function attachedStart({ text, comments, offset }: AttachedStartInput): number {
  let currentOffset = offset;
  let previous = previousAttachedComment({ text, comments, offset: currentOffset });

  while (Option.isSome(previous)) {
    currentOffset = previous.value.start;
    previous = previousAttachedComment({ text, comments, offset: currentOffset });
  }

  return currentOffset;
}

function previousAttachedComment({ text, comments, offset }: AttachedStartInput): Option.Option<Comment> {
  const previous = Array.findLast(comments, ({ end }) => end <= offset);

  if (
    Option.isNone(previous) ||
    !ATTACHED_GAP.test(text.slice(previous.value.end, offset)) ||
    text.slice(text.lastIndexOf('\n', previous.value.start) + 1, previous.value.start).trim() !== ''
  ) {
    return Option.none();
  }

  return previous;
}
