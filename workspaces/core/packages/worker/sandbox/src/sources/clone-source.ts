import type { SourceFence } from '@mechane/sandbox-store';
import { SourceFencePhase } from '@mechane/sandbox-wire';
import type { SourceClone, SourceFenceReport } from '@mechane/sandbox-wire';
import { DateTime, Option, Result } from 'effect';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { exposeSource } from './cloning/expose-source.ts';
import { findSourceFence } from './find-source-fence.ts';
import { matchesSourceCheckout } from './matches-source-checkout.ts';
import { sourceReport } from './source-report.ts';

type CloneSourceInput = WorkspaceProviderStepInput & { readonly clone: SourceClone };
type SourceExposureInput = { readonly fence: SourceFence; readonly clone: SourceClone };

/** A credential is delivered only to the matching prepared guest while the credential remains valid. */
export async function cloneSource({ store, provider, clone }: CloneSourceInput): Promise<SourceFenceReport> {
  const saved = findSourceFence({ store, sourceId: clone.sourceId, generation: clone.generation });

  if (Result.isFailure(saved)) {
    return saved.failure;
  }

  const fence = saved.success;

  if (!canExposeSource({ fence, clone }) || Option.isNone(fence.machineId)) {
    return { ...sourceReport({ fence }), reason: Option.some('source checkout cannot expose this credential') };
  }

  const guest = await provider.connect({ machineId: fence.machineId.value });

  if (Option.isNone(guest)) {
    return { ...sourceReport({ fence }), reason: Option.some('source guest is unavailable') };
  }

  return await exposeSource({ store, fence, clone, machineId: fence.machineId.value, guest: guest.value });
}

function canExposeSource({ fence, clone }: SourceExposureInput): boolean {
  const now = DateTime.nowUnsafe();
  const isExpired = DateTime.isGreaterThanOrEqualTo(now, clone.expiresAt);

  return matchesSourceCheckout({ fence, checkout: clone }) && fence.phase === SourceFencePhase.Prepared && !isExpired;
}
