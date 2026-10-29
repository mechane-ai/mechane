import type { OwedNote } from '@mechane/harness';
import type { OwedNoteRow } from '@mechane/mech-store';
import type { TablesInput } from '../types.ts';

/** The notes the alarm owes pi, each with the inbox items of its turn. */
export function readOwedNotes({ store }: TablesInput): ReadonlyArray<OwedNote> {
  const owedNote: (row: OwedNoteRow) => OwedNote = ({ id, reason, owedAt }) => ({
    turnId: id,
    inboxItemIds: store.turnInboxItemIds({ turnId: id }),
    reason,
    owedAt,
  });

  return store.owedNotes().map(owedNote);
}
