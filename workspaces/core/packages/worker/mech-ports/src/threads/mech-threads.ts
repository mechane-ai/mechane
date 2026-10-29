import type { DroneStartOutcome, MechThreads, ThreadChangeOutcome, ThreadOpeningOutcome } from '@mechane/harness-tools';
import type { MechStore, MechTables } from '@mechane/mech-store';
import type { WakeList } from '@mechane/utilities';
import { DateTime } from 'effect';
import type { RecordedSignal } from '../types.ts';
import { decideDroneStart } from './decide-drone-start.ts';
import { decideThreadChange } from './decide-thread-change.ts';
import { decideThreadOpening } from './decide-thread-opening.ts';

/** What the mech's threads port works through: its store, and the signals a recorded drone wakes. */
type MechThreadsInput = { readonly store: MechStore; readonly signal: WakeList; readonly recorded: RecordedSignal };

/**
 * The mech's threads and drones in its own tables, each call one transaction queued behind every pi commit before it.
 * Thread changes and drone starts stand however the turn that made them ends. A drone start releases its event and
 * marks the signal, so the alarm's work, in whose event every tool runs, starts the drone at its next poll.
 */
export function mechThreads({ store, signal, recorded }: MechThreadsInput): MechThreads {
  const open: MechThreads['open'] = async (opening) => {
    const now = DateTime.nowUnsafe();

    const decide: (tables: MechTables) => ThreadOpeningOutcome = (tables) =>
      decideThreadOpening({ store: tables, ...opening, now });

    return await store.atomic({ run: decide });
  };

  const update: MechThreads['update'] = async (change) => {
    const now = DateTime.nowUnsafe();

    const decide: (tables: MechTables) => ThreadChangeOutcome = (tables) =>
      decideThreadChange({ store: tables, ...change, now });

    return await store.atomic({ run: decide });
  };

  const startDrone: MechThreads['startDrone'] = async (start) => {
    const now = DateTime.nowUnsafe();

    const decide: (tables: MechTables) => DroneStartOutcome = (tables) =>
      decideDroneStart({ store: tables, ...start, now });

    const outcome = await store.atomic({ run: decide });

    signal.wake();
    recorded.mark();

    return outcome;
  };

  const openThreads: MechThreads['openThreads'] = async () =>
    await store.atomic({ run: (tables) => tables.openThreads() });

  return { open, update, startDrone, openThreads };
}
