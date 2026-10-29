import type { SourceTask } from '@mechane/mech-store';
import { SourceStatus } from '@mechane/protocol';
import { SourceFencePhase } from '@mechane/sandbox-wire';
import type { SourceFenceReport } from '@mechane/sandbox-wire';
import type { SourceTaskInput } from '../types.ts';

type SaveSourceFenceInput = SourceTaskInput & { readonly fence: SourceFenceReport };

/** A checkout becomes ready only after the sandbox records a completed credential-free checkpoint. */
export async function saveSourceFence({ mech, source, fence }: SaveSourceFenceInput): Promise<SourceTask> {
  let status: SourceStatus = SourceStatus.Fenced;

  switch (fence.phase) {
    case SourceFencePhase.Ready:
      status = SourceStatus.Ready;
      break;
    case SourceFencePhase.Failed:
      status = SourceStatus.Failed;
      break;
    case SourceFencePhase.Preparing:
    case SourceFencePhase.Prepared:
      status = SourceStatus.Preparing;
      break;
    case SourceFencePhase.Exposed:
    case SourceFencePhase.Revoked:
    case SourceFencePhase.Finalizing:
      break;
  }

  const next = { ...source, status, reason: fence.reason };

  await mech.store.atomic({ run: (store) => store.saveSourceTask({ source: next }) });

  return next;
}
