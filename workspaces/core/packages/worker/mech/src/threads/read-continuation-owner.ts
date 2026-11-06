import type { MechRow } from '@mechane/mech-store';
import { MechStatus } from '@mechane/protocol';
import { Option } from 'effect';
import type { TablesInput } from '../types.ts';

/** Retain replaceable wakeups while busy, without repeatedly arming a deadline that has already passed. */
export function readContinuationOwner({ store }: TablesInput): Option.Option<MechRow> {
  const mech = store.mech();

  if (Option.isNone(mech) || mech.value.status !== MechStatus.Active) {
    return Option.none();
  }

  const running = store.runningTurn();

  if (Option.isSome(running) || store.pendingInboxItems().length > 0) {
    return Option.none();
  }

  if (store.runningDrones().length > 0 || store.owedNotes().length > 0) {
    return Option.none();
  }

  return mech;
}
