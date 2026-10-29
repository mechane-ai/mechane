import type { TurnReading } from '@mechane/rpc';
import { Option } from 'effect';
import type { TablesInput } from '../types.ts';
import { turnFields } from './turn-fields.ts';

type TurnIdInput = { readonly turnId: string };

/** A turn with the inbox items it took up, read in one transaction. */
export function readTurn({ store, turnId }: TablesInput & TurnIdInput): TurnReading {
  const turn = store.turn({ turnId });

  if (Option.isNone(store.mech())) {
    return { _tag: 'MechMissing' };
  }

  if (Option.isNone(turn)) {
    return { _tag: 'TurnMissing' };
  }

  return { _tag: 'Found', turn: turnFields({ turn: turn.value, inboxItemIds: store.turnInboxItemIds({ turnId }) }) };
}
