import type { CaughtUpInput } from './types.ts';

/** Whether the alarm owes nothing: no note, abort, delivery, start or stop. */
export function isCaughtUp({ caught }: CaughtUpInput): boolean {
  const { notes, aborts, deliveries, starts, stops } = caught;

  return !caught.isIndexDue && [notes, aborts, deliveries, starts, stops].every((owed) => owed.length === 0);
}
