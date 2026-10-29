import type { AbortObject, ChangesInput } from '@mechane/harness';
import type { RecordedSignal } from '@mechane/mech-ports';
import type { MechStore, MechTables } from '@mechane/mech-store';
import type { WakeList } from '@mechane/utilities';
import { DateTime, Match } from 'effect';
import { projectChanges } from './project-changes.ts';
import type { ProgressTest } from './types.ts';

/** Whether an item's progress ends its turn without a reply, which may owe the note that restarts its run's queue. */
const IS_UNANSWERED: Readonly<ProgressTest> = {
  Placed: () => false,
  Answered: () => false,
  Unanswered: () => true,
  Written: () => false,
};

/** What the projection of pi's progress writes through, the signals it wakes, and what resets the object on failure. */
type ProjectInput = {
  readonly store: MechStore;
  readonly signal: WakeList;
  readonly recorded: RecordedSignal;
  readonly abortObject: AbortObject;
};

/**
 * Enqueues the projection of pi's progress behind every host transaction already queued, and wakes the waiting lists of
 * events once it commits. A drone's end recorded its report item, and an unanswered turn may owe the note that restarts
 * its run's queue, so either marks the signal for the alarm. A projection that fails resets the object, and the
 * catch-up of its next open repairs it.
 */
export function projectProgress({
  store,
  signal,
  recorded,
  abortObject,
  changes,
  droneEnds,
}: ProjectInput & ChangesInput): void {
  const now = DateTime.nowUnsafe();
  const project: (tables: MechTables) => void = (tables) => projectChanges({ store: tables, changes, droneEnds, now });

  const projected: () => void = () => {
    signal.wake();

    if (droneEnds.length > 0 || changes.some(({ progress }) => Match.valueTags(progress, IS_UNANSWERED))) {
      recorded.mark();
    }
  };

  const failed: (cause: unknown) => void = (cause) => abortObject({ operation: "project pi's progress", cause });

  void store.atomic({ run: project }).then(projected, failed);
}
