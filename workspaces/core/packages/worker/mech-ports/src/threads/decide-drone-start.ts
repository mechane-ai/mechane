import { DroneStartOutcome } from '@mechane/harness-tools';
import type { DroneStart } from '@mechane/harness-tools';
import { EventType, RUNNING_DRONES_PER_MECH, ThreadState } from '@mechane/protocol';
import { DroneId } from '@mechane/records';
import { Option } from 'effect';
import type { PortDecisionInput } from './types.ts';

/** A start_drone call, decided in one transaction at the time of the call. */
type DroneStartDecision = DroneStart & PortDecisionInput;

/**
 * Decides a start_drone call in one transaction: a task that started its drone answers with it, so pi's rerun after a
 * restart answers the same. Otherwise a drone starts on an open thread under the running limit, recorded with its
 * event, its own and its report item's ids, and the memory version it reads. The alarm opens its conversation, so a
 * turn that ends at once still leaves the drone to run.
 */
export function decideDroneStart({ store, taskId, threadId, brief, now }: DroneStartDecision): DroneStartOutcome {
  const started = store.startedDrone({ taskId });
  const thread = store.thread({ threadId });

  if (Option.isSome(started)) {
    return DroneStartOutcome.cases.Started.make({ droneId: started.value.id });
  }

  if (Option.isNone(thread)) {
    return DroneStartOutcome.cases.ThreadMissing.make({});
  }

  if (thread.value.state === ThreadState.Resolved) {
    return DroneStartOutcome.cases.ThreadResolved.make({});
  }

  if (store.runningDroneCount() >= RUNNING_DRONES_PER_MECH) {
    return DroneStartOutcome.cases.DronesFull.make({});
  }

  const droneId = DroneId.make(crypto.randomUUID());
  const startedOn = thread.value.id;

  store.startDrone({ droneId, threadId: startedOn, taskId, brief, reportInboxItemId: crypto.randomUUID(), now });
  store.appendEvent({ event: { type: EventType.DroneStarted, droneId, threadId: startedOn }, now });

  return DroneStartOutcome.cases.Started.make({ droneId });
}
