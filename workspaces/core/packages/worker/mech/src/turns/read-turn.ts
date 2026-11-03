import { TurnReplyExcerpt, TurnStatus } from '@mechane/protocol';
import type { TurnInput, TurnReading } from '@mechane/rpc';
import { Option, Schema } from 'effect';
import type { TablesInput } from '../types.ts';
import { turnFields } from './turn-fields.ts';

/** A turn with the inbox items it took up, read in one transaction. */
export function readTurn({ store, turnId }: TablesInput & TurnInput): TurnReading {
  const turn = store.turn({ turnId });

  if (Option.isNone(store.mech())) {
    return { _tag: 'MechMissing' };
  }

  if (Option.isNone(turn)) {
    return { _tag: 'TurnMissing' };
  }

  const fields = turnFields({ turn: turn.value, inboxItemIds: store.turnInboxItemIds({ turnId }) });
  const found = { _tag: 'Found', turn: fields, replyExcerpt: null } as const;

  if (turn.value.status !== TurnStatus.Answered) {
    return found;
  }

  const reply = store.turnReplyExcerpt({ turnId });

  if (Option.isNone(reply)) {
    return found;
  }

  const replyExcerpt = Schema.encodeSync(TurnReplyExcerpt)(reply.value);

  return { ...found, replyExcerpt };
}
