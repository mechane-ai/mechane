import { TurnsAnswer } from '@mechane/rpc';
import { Option } from 'effect';
import type { PageInput } from '../types.ts';

/** Joins a bounded turn page with its inbox references in one transaction. */
export function readTurns({ store, after }: PageInput): TurnsAnswer {
  const mech = store.mech();

  if (Option.isNone(mech)) {
    return TurnsAnswer.cases.MechMissing.make({});
  }

  const page = store.turns({ after });

  if (Option.isNone(page)) {
    return TurnsAnswer.cases.CursorMissing.make({});
  }

  const turns = page.value.rows.map((turn) => ({ ...turn, inboxItemIds: store.turnInboxItemIds({ turnId: turn.id }) }));

  return TurnsAnswer.cases.Listed.make({ turns, hasMore: page.value.hasMore });
}
