import { createRegistry } from '@earendil-works/pi-durable';
import type { HarnessOptions, HarnessSettings } from '@earendil-works/pi-durable';
import { Duration } from 'effect';
import { logReport } from './log-report.ts';
import { meteredModels } from './models/metered-models.ts';
import type { MechExtensions, OpenMechHarnessInput, WakeSignal } from './types.ts';

/** What pi's options for a mech are built from: its upstream, its meter, its reports, its extensions and its wakes. */
type HarnessOptionsInput = Pick<OpenMechHarnessInput, 'modelUpstream' | 'meter' | 'mechId' | 'abortObject'> &
  Pick<MechExtensions, 'extensions'> & { readonly wakes: WakeSignal };

/** How long one dispatch may stream before pi ends it. */
const DISPATCH_DEADLINE = Duration.minutes(5);

/**
 * pi's run policy for every mech. Compaction runs only inside a turn, so every dispatch belongs to one, and a turn
 * whose model failed hands the inbox on, while an aborted or faulted one keeps it. Every item sent for the next pause
 * joins the turn at that pause, and pi's durable retry is the one retry owner.
 */
const HARNESS_SETTINGS = {
  stream: { timeoutMs: Duration.toMillis(DISPATCH_DEADLINE) },
  compaction: { backgroundTokens: 0 },
  afterFailedRun: 'continue',
  steeringMode: 'all',
} as const satisfies HarnessSettings;

/** Mechane's model requests carry no provider attribution, which pi's default would credit to pi. */
const HARNESS_IDENTITY = { attribution: null } as const;

/**
 * pi's options for a mech: metered models, a registry of pi's built-in tasks and the mech's extensions, and the mech's
 * turn policy. The alarm arms itself, so `onWake` only announces, and pi arms no timer of its own for a sleep. Each
 * report is logged, and a fatal one resets the object.
 */
export function harnessOptions({
  modelUpstream,
  meter,
  extensions,
  wakes,
  mechId,
  abortObject,
}: HarnessOptionsInput): HarnessOptions {
  const registry = createRegistry();

  for (const extension of extensions) {
    registry.install(extension);
  }

  return {
    models: meteredModels({ modelUpstream, meter }),
    identity: HARNESS_IDENTITY,
    registry,
    settings: HARNESS_SETTINGS,
    onWake: () => wakes.announce(),
    onReport: (error, report) => logReport({ error, report, mechId, abortObject }),
  };
}
