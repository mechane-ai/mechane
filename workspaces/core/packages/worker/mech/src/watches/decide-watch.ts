import type { WatchRow } from '@mechane/mech-store';
import { WATCHES_PER_MECH } from '@mechane/protocol';
import type { WatchConfiguration } from '@mechane/protocol';
import type { PrincipalId, WatchId } from '@mechane/records';
import { WatchAnswer } from '@mechane/rpc';
import { DateTime, Duration, Option } from 'effect';
import type { AlarmDecision, TablesInput } from '../types.ts';
import { decideWatchChange } from './decide-watch-change.ts';

type DecideWatchInput = TablesInput & {
  readonly watchId: WatchId;
  readonly configuration: WatchConfiguration;
  readonly creatorId: PrincipalId;
  readonly now: DateTime.Utc;
};

/** Saves a bounded watch configuration while preserving its identity and recorded outcomes. */
export function decideWatch({
  store,
  watchId,
  configuration,
  creatorId,
  now,
}: DecideWatchInput): AlarmDecision<WatchAnswer> {
  const save: (existing: Option.Option<WatchRow>) => WatchAnswer = (existing) => {
    if (Option.isNone(existing) && store.watches().length >= WATCHES_PER_MECH) {
      return WatchAnswer.cases.LimitReached.make({});
    }

    const watch = configuredWatch({ existing, watchId, configuration, creatorId, now });

    store.setWatch({ watch });

    return WatchAnswer.cases.Saved.make({ watch });
  };

  return decideWatchChange({ store, watchId, save });
}

type ConfiguredWatchInput = Omit<DecideWatchInput, 'store'> & {
  /** Absent when this ID has no saved schedule yet. */
  readonly existing: Option.Option<WatchRow>;
};

function configuredWatch({ existing, watchId, configuration, creatorId, now }: ConfiguredWatchInput): WatchRow {
  if (Option.isNone(existing)) {
    return {
      ...configuration,
      id: watchId,
      creatorId,
      createdAt: now,
      updatedAt: now,
      nextRunAt: now,
      lastCheckOutcome: Option.none(),
      lastCheckedAt: Option.none(),
    };
  }

  const interval = Duration.seconds(configuration.intervalSeconds);
  const later = DateTime.addDuration(now, interval);
  const nextRunAt = DateTime.min(existing.value.nextRunAt, later);

  return { ...existing.value, ...configuration, updatedAt: now, nextRunAt };
}
