import { movedPath } from '@mechane/checks-kernel';
import type { PathMove } from '@mechane/checks-kernel';

/** A text, the step's moves, and the pattern of every path they move. */
type ReplacedPathsInput = { readonly text: string; readonly moves: ReadonlyArray<PathMove>; readonly pattern: RegExp };

/** A text with each path the pattern matches rewritten to where the step's moves take it. */
export function replacedPaths({ text, moves, pattern }: ReplacedPathsInput): string {
  /** A matched path, after its lead, where the moves take it. */
  const replacement: (whole: string, prefix: string, path: string) => string = (_whole, prefix, path) =>
    `${prefix}${movedPath({ moves, path })}`;

  return text.replaceAll(pattern, replacement);
}
