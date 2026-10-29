import type { WatchRow } from '@mechane/mech-store';
import { WatchStatus } from '@mechane/protocol';
import type { WatchId } from '@mechane/records';
import { WatchAnswer } from '@mechane/rpc';
import { Option } from 'effect';
import type { AlarmDecision, TablesInput } from '../types.ts';

type DecideWatchChangeInput = TablesInput & {
  readonly watchId: WatchId;
  /** Receives an absent watch when this schedule ID has not been saved. */
  readonly save: (existing: Option.Option<WatchRow>) => WatchAnswer;
};

/** Resolves the owning mech, applies a watch change, and wakes only a saved active schedule. */
export function decideWatchChange({ store, watchId, save }: DecideWatchChangeInput): AlarmDecision<WatchAnswer> {
  const mech = store.mech();

  if (Option.isNone(mech)) {
    return { answer: WatchAnswer.cases.MechMissing.make({}), isAlarmDue: false };
  }

  const existing = store.watch({ watchId });
  const answer = save(existing);
  const isAlarmDue = WatchAnswer.guards.Saved(answer) && answer.watch.status === WatchStatus.Active;

  return { answer, isAlarmDue };
}
