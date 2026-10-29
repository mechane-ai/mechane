import type { RecordId } from '@mechane/records';
import { SourceFencePhase, SourceGuestAnswer, SourceStep } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import type { GuestConnection } from '../../types.ts';
import { callSourceGuest } from '../guest/call-source-guest.ts';
import type { SourceFinalizeInput } from '../types.ts';
import type { SourceOutcome } from './types.ts';

type SourceReleaseInput = SourceFinalizeInput & { readonly guest: GuestConnection; readonly machineId: RecordId };

/** The guest resumes commands only after activation and release; an incomplete release destroys the guest. */
export async function releaseSourceGuest({
  store,
  provider,
  workspace,
  fence,
  guest,
  machineId,
}: SourceReleaseInput): Promise<SourceOutcome> {
  let outcome: SourceOutcome = { phase: SourceFencePhase.Failed, reason: fence.reason };

  if (fence.isCloned) {
    outcome = await activateClonedSource({ store, provider, workspace, fence, guest, machineId });
  }

  const body = Option.none<string>();
  const released = await callSourceGuest({ ...fence, guest, machineId, step: SourceStep.Release, body });

  if (!SourceGuestAnswer.guards.Ready(released)) {
    await provider.stop({ machineId });

    return { phase: SourceFencePhase.Failed, reason: Option.some('source checkout could not release its guest fence') };
  }

  return outcome;
}

async function activateClonedSource({ fence, guest, machineId }: SourceReleaseInput): Promise<SourceOutcome> {
  const body = Option.none<string>();
  const activated = await callSourceGuest({ ...fence, guest, machineId, step: SourceStep.Activate, body });

  if (SourceGuestAnswer.guards.Ready(activated)) {
    return { phase: SourceFencePhase.Finalizing, reason: fence.reason };
  }

  return { phase: SourceFencePhase.Failed, reason: Option.some('source checkout could not be activated') };
}
