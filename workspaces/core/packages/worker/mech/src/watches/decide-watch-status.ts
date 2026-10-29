import type { WatchRow } from '@mechane/mech-store';
import type { WatchStatus } from '@mechane/protocol';
import type { WatchId } from '@mechane/records';
import { WatchAnswer } from '@mechane/rpc';
import { Option } from 'effect';
import type { DateTime } from 'effect';
import type { AlarmDecision, TablesInput } from '../types.ts';
import { decideWatchChange } from './decide-watch-change.ts';

type DecideWatchStatusInput = TablesInput & {
  readonly watchId: WatchId;
  readonly status: WatchStatus;
  readonly now: DateTime.Utc;
};

/** Changes only the watch scheduling state and wakes the host when it resumes. */
export function decideWatchStatus({ store, watchId, status, now }: DecideWatchStatusInput): AlarmDecision<WatchAnswer> {
  const save: (existing: Option.Option<WatchRow>) => WatchAnswer = (existing) => {
    if (Option.isNone(existing)) {
      return WatchAnswer.cases.WatchMissing.make({});
    }

    store.setWatchStatus({ watchId, status, now });

    const watch = { ...existing.value, status, updatedAt: now };

    return WatchAnswer.cases.Saved.make({ watch });
  };

  return decideWatchChange({ store, watchId, save });
}
