import type { ListedStatement } from '@mechane/modules';
import { Spacing } from './constants.ts';
import { statementSpacing } from './statement-spacing.ts';

/** The spacings that part a statement from a neighbor: one apart, and a call beside anything but a call. */
const PARTING: ReadonlySet<Spacing> = new Set([Spacing.Apart, Spacing.Call]);

/** Two neighbors of one list of statements, and the text of their file. */
type IsPartedInput = { readonly previous: ListedStatement; readonly next: ListedStatement; readonly text: string };

/**
 * Whether two neighbors need a blank line between them: one parts them, unless both are calls or the first is an
 * overload signature. The next signature or the implementation follows a signature directly.
 */
export function isParted({ previous, next, text }: IsPartedInput): boolean {
  const before = statementSpacing({ statement: previous, text });
  const after = statementSpacing({ statement: next, text });

  if (before === Spacing.Overload || (before === Spacing.Call && after === Spacing.Call)) {
    return false;
  }

  return PARTING.has(before) || PARTING.has(after);
}
