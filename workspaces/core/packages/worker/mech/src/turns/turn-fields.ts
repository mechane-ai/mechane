import type { TurnRow } from '@mechane/mech-store';
import { TurnStatus } from '@mechane/protocol';
import type { TurnFields } from '@mechane/rpc';
import { DateTime } from 'effect';

/** A turn of the mech, and the inbox items it took up. */
type TurnFieldsInput = { readonly turn: TurnRow; readonly inboxItemIds: TurnFields['inboxItemIds'] };

/**
 * A turn as the mech's object answers it, with its times in milliseconds since the epoch. A turn that runs has no end,
 * and only an unanswered one has a reason, which the answer gives as null.
 */
export function turnFields({ turn, inboxItemIds }: TurnFieldsInput): TurnFields {
  const startedAtMs = DateTime.toEpochMillis(turn.startedAt);
  const definitionRevision = turn.definitionRevision;
  const fields = { id: turn.id, status: turn.status, inboxItemIds, startedAtMs, definitionRevision };

  switch (turn.status) {
    case TurnStatus.Running:
      return { ...fields, endedAtMs: null, reason: null };
    case TurnStatus.Answered:
      return { ...fields, endedAtMs: DateTime.toEpochMillis(turn.endedAt), reason: null };
    case TurnStatus.Unanswered:
      return { ...fields, endedAtMs: DateTime.toEpochMillis(turn.endedAt), reason: turn.reason };
  }
}
