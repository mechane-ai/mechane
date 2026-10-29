import type { AbortObject, OpenMechHarnessInput } from '@mechane/harness';
import { mechExtensions } from '@mechane/harness-tools';
import { dispatchMeter, drainableMeter, mechMemory, mechRemoteTools, mechThreads } from '@mechane/mech-ports';
import type { MechMeter, RecordedSignal } from '@mechane/mech-ports';
import type { MechStore } from '@mechane/mech-store';
import type { ObjectSettings } from '@mechane/rpc';
import type { WakeList } from '@mechane/utilities';
import { mechFindings } from './findings/mech-findings.ts';
import { mechHands } from './hands/mech-hands.ts';

/** What the ports of the mech's Harness work through: its store, its settings, its signals and its reset. */
type MechPortsInput = {
  readonly store: MechStore;
  readonly settings: ObjectSettings;
  readonly signal: WakeList;
  readonly recorded: RecordedSignal;
  readonly abortObject: AbortObject;
};

/** The ports of the mech's Harness: its meter, and the extensions its tools reach the mech through. */
type MechPorts = Pick<OpenMechHarnessInput, 'extensions' | 'selection'> & { readonly meter: MechMeter };

/**
 * What the mech's Harness reaches the mech through: the meter its dispatches pass, which the alarm can drain, and its
 * tools' extensions. The extensions reach the sandboxes of the mech and its drones, its memory, and its threads and
 * drones.
 */
export function mechPorts({ store, settings, signal, recorded, abortObject }: MechPortsInput): MechPorts {
  const remote = mechRemoteTools({ store, settings });
  const findings = mechFindings({ store, recorded });

  return {
    meter: drainableMeter({ meter: dispatchMeter({ store, settings, abortObject }) }),
    ...mechExtensions({
      hands: mechHands({ store, settings }),
      findings,
      remote,
      memory: mechMemory({ store }),
      threads: mechThreads({ store, signal, recorded }),
    }),
  };
}
