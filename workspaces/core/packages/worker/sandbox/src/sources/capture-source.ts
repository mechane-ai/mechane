import { SourceGuestAnswer } from '@mechane/sandbox-wire';
import type { SourceCapture } from '@mechane/sandbox-wire';
import { DateTime, Duration, Option } from 'effect';
import { observeMachine } from '../machines/observe-machine.ts';
import { readyWorkspaceMachine } from '../machines/ready-workspace-machine.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { advanceWorkspace } from '../workspace/advance-workspace.ts';
import { captureSourceChanges } from './capture/capture-source-changes.ts';

type SourceCaptureInput = WorkspaceProviderStepInput & { readonly capture: SourceCapture };

/** Captures committed files outside a credential lease, restoring a machine after idle stop when necessary. */
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

  const input = { store, provider, workspace };

  if (!(await advanceWorkspace(input))) {
    return SourceGuestAnswer.cases.Pending.make({});
  }

  const state = store.workspace();

  if (Option.isSome(state.recovery)) {
    return SourceGuestAnswer.cases.Failed.make({ reason: 'source capture requires recovery of the failed file save' });
  }

  await observeMachine(input);

  const now = DateTime.nowUnsafe();
  const wait = Duration.seconds(1);
  const deadline = DateTime.addDuration(now, wait);
  const machine = await readyWorkspaceMachine({ ...input, deadline });

  if (Option.isNone(machine)) {
    return SourceGuestAnswer.cases.Pending.make({});
  }

  return await captureSourceChanges({ capture, machineId: machine.value.id, provider });
}
