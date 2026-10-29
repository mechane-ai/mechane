import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { Harness } from '@earendil-works/pi-durable';
import type { CommitPublication } from '@earendil-works/pi-durable';
import { abortParkedTasks } from './abort-parked-tasks.ts';
import { armAlarm } from './arm-alarm.ts';
import { closeHarness } from './close-harness.ts';
import { deliverInboxItem } from './deliver-inbox-item.ts';
import { abortDrone } from './drones/abort-drone.ts';
import { deliverBrief } from './drones/deliver-brief.ts';
import { openDrone } from './drones/open-drone.ts';
import { harnessOptions } from './harness-options.ts';
import { answerCache } from './progress/answer-cache.ts';
import { itemChanges } from './progress/item-changes.ts';
import { readProgress } from './progress/read-progress.ts';
import { renewProvider } from './renew-provider.ts';
import { closeTurn } from './turns/close-turn.ts';
import type { HarnessHandle, MechHarness, OpenMechHarnessInput } from './types.ts';
import { wakeSignal } from './wake-signal.ts';
import { workUntilIdle } from './work-until-idle.ts';

/** The opened Harness whose commits are reported, and the listener `onChanges` they reach. */
type SubscribeChangesInput = HarnessHandle & Pick<OpenMechHarnessInput, 'onChanges'>;

/**
 * Opens a mech's pi Harness on its shared database, with scheduling paused until the alarm lets it work, and marks
 * aborted each task pi parked. Every commit that moved an inbox item or ended a drone's brief reaches `onChanges`, and
 * `onWake` announces each change of what pi needs next, which ends the alarm's wait.
 */
export async function openMechHarness({
  database,
  alarm,
  onChanges,
  extensions,
  selection,
  ...configured
}: OpenMechHarnessInput): Promise<MechHarness> {
  const wakes = wakeSignal();
  const options = harnessOptions({ ...configured, extensions, wakes });
  const harness = await Harness.open(await database.openPiStorage(), options, BACKGROUND_CONTEXT);

  subscribeChanges({ harness, onChanges });
  await abortParkedTasks({ harness });

  const armNext: MechHarness['armNext'] = ({ isDue }) => armAlarm({ alarm, wake: harness.wake(), isDue });

  return {
    deliver: ({ inboxItem, agent }) => deliverInboxItem({ harness, inboxItem, agent }),
    close: (note) => closeTurn({ harness, note }),
    progress: (query) => readProgress({ harness, ...query }),
    openDrone: (opening) => openDrone({ harness, selection, ...opening }),
    deliverBrief: (briefing) => deliverBrief({ harness, ...briefing }),
    abortDrone: ({ droneId }) => abortDrone({ harness, droneId }),
    work: ({ stop }) => workUntilIdle({ harness, wakes, alarm, stop }),
    armNext,
    renewProvider: () => renewProvider({ harness }),
    release: () => closeHarness({ harness }),
  };
}

/** Reports each pi commit that moved an inbox item or ended a drone's brief, with the answers it may settle with. */
function subscribeChanges({ harness, onChanges }: SubscribeChangesInput): void {
  const cache = answerCache();

  const reportChanges: (publication: CommitPublication) => void = (publication) => {
    const moved = itemChanges({ publication, answers: cache.answers({ publication }) });

    if (moved.changes.length > 0 || moved.droneEnds.length > 0) {
      onChanges(moved);
    }
  };

  harness.subscribeCommits(reportChanges);
}
