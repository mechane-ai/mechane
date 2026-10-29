import type { Harness } from '@earendil-works/pi-durable';
import { WaitEnd, wakeList } from '@mechane/utilities';
import { DateTime, Duration, Option } from 'effect';
import type { UntilIdleInput, WakeSignal } from './types.ts';

/** The opened Harness, whose earliest sleep bounds a round's wait. */
type SleepInput = { readonly harness: Harness };

/**
 * pi's announcements that what it needs next changed, which the alarm waits on until pi has no work that can run. Since
 * pi arms no timer for a sleep, a round's wait ends at pi's earliest sleep and resumes pi itself, while other work
 * runs. A model retry's backoff beside a drone's long command then waits its backoff, not the command.
 */
export function wakeSignal(): WakeSignal {
  const wakes = wakeList();

  const nextWake: (input: UntilIdleInput) => Promise<boolean> = async ({ harness, stop }) => {
    const { ended } = wakes.wait({ timeout: untilSleep({ harness }), stop: Option.some(stop) });
    const end = await ended;

    if (end === WaitEnd.TimedOut) {
      harness.resume();
    }

    return end === WaitEnd.Stopped;
  };

  const untilIdle: WakeSignal['untilIdle'] = async ({ harness, stop }) => {
    let isStopped = false;

    while (!isStopped && harness.wake().active) {
      isStopped = await nextWake({ harness, stop });
    }

    return isStopped;
  };

  return { announce: wakes.wake, untilIdle };
}

/** How long until pi's earliest sleep ends, none when pi sleeps for nothing. */
function untilSleep({ harness }: SleepInput): Option.Option<Duration.Duration> {
  const nowMs = DateTime.toEpochMillis(DateTime.nowUnsafe());

  return Option.map(Option.fromNullishOr(harness.wake().at), (atMs) => Duration.millis(atMs - nowMs));
}
