import { lineAt } from '@mechane/modules';
import { Array, Option } from 'effect';

/** A file's text before and after a rewrite. */
type ChangedLineInput = { readonly before: string; readonly after: string };

/** The line, counted from 1, of the first character a rewrite changes. */
export function changedLine({ before, after }: ChangedLineInput): number {
  const differing = Array.findFirstIndex(before.split(''), (character, index) => character !== after[index]);
  const offset = Option.getOrElse(differing, () => before.length);

  return lineAt({ text: before, offset });
}
