import { ExecutionProgress, SourceGuestAnswer } from '@mechane/sandbox-wire';
import type { SourceCapture } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { captureSourceChanges } from './capture/capture-source-changes.ts';
import { SourceCheckpointKind } from './constants.ts';
import { runSourceCheckpoint } from './run-source-checkpoint.ts';

type SourceCaptureInput = WorkspaceProviderStepInput & { readonly capture: SourceCapture };

/** Captures only outside a credential lease, after the sandbox has completed its preparation execution. */
export async function captureSource({
  store,
  provider,
  workspace,
  capture,
}: SourceCaptureInput): Promise<SourceGuestAnswer> {
  const active = store.activeSourceFence();

  if (Option.isSome(active)) {
    return SourceGuestAnswer.cases.Pending.make({});
  }

  const progress = await runSourceCheckpoint({
    store,
    provider,
    workspace,
    sourceId: capture.sourceId,
    kind: SourceCheckpointKind.Capture,
  });

  if (ExecutionProgress.guards.Running(progress)) {
    return SourceGuestAnswer.cases.Pending.make({});
  }

  const live = store.liveMachine();

  if (!ExecutionProgress.guards.Exited(progress) || Option.isNone(live)) {
    return SourceGuestAnswer.cases.Failed.make({ reason: 'source capture could not start its guest' });
  }

  const machineId = live.value.id;

  return await captureSourceChanges({ capture, machineId, provider });
}
