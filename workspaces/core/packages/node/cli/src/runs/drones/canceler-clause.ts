import type { Drone } from '@mechane/protocol';
import { Option } from 'effect';

/** A drone a member may cancel: one running, or one that ended unreported. */
type CancelableDrone = Extract<Drone, Readonly<Record<'cancelerId', unknown>>>;

type CancelerClauseInput = Pick<CancelableDrone, 'cancelerId'>;

/** Who canceled a drone, if a member did, as the clause that ends its line. */
export function cancelerClause({ cancelerId }: CancelerClauseInput): string {
  if (Option.isNone(cancelerId)) {
    return '';
  }

  return `, canceled by ${cancelerId.value}`;
}
