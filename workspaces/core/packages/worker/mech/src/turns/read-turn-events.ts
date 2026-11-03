import type { TurnId } from '@mechane/records';
import { TurnEventsAnswer } from '@mechane/rpc';
import { Option } from 'effect';
import type { TablesInput } from '../types.ts';

type ReadTurnEventsInput = TablesInput & { readonly turnId: TurnId; readonly after: number };

/** Checks ownership and selects a turn's event page in the same store transaction. */
export function readTurnEvents({ store, turnId, after }: ReadTurnEventsInput): typeof TurnEventsAnswer.Type {
  const mech = store.mech();

  if (Option.isNone(mech)) {
    return TurnEventsAnswer.cases.MechMissing.make({});
  }

  const turn = store.turn({ turnId });

  if (Option.isNone(turn)) {
    return TurnEventsAnswer.cases.TurnMissing.make({});
  }

  const page = store.turnEvents({ turnId, after });

  return TurnEventsAnswer.cases.Listed.make({ page: { events: page.rows, hasMore: page.hasMore } });
}
