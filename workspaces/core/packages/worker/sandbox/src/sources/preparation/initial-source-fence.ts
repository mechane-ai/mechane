import type { SourceFence } from '@mechane/sandbox-store';
import { SOURCE_PREPARATION_TIMEOUT, SourceFencePhase } from '@mechane/sandbox-wire';
import type { SourceCheckout } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';

type InitialSourceFenceInput = { readonly checkout: SourceCheckout };

/** The preparation deadline is fixed before machine work begins and is never extended by polling. */
export function initialSourceFence({ checkout }: InitialSourceFenceInput): SourceFence {
  const now = DateTime.nowUnsafe();
  const preparationDeadline = DateTime.addDuration(now, SOURCE_PREPARATION_TIMEOUT);

  return {
    ...checkout,
    phase: SourceFencePhase.Preparing,
    machineId: Option.none(),
    isMachineStarted: false,
    expiresAt: Option.none(),
    preparationDeadline,
    isCloned: false,
    reason: Option.none(),
  };
}
