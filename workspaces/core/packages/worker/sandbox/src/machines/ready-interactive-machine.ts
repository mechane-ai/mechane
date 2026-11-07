import type { LiveMachineRow } from '@mechane/sandbox-store';
import { DateTime, Duration, Option } from 'effect';
import { advanceToIdleExecution } from '../executions/advance-to-idle-execution.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { advanceWorkspace } from '../workspace/advance-workspace.ts';
import { observeMachine } from './observe-machine.ts';
import { readyWorkspaceMachine } from './ready-workspace-machine.ts';

const INTERACTIVE_WAIT = Duration.seconds(1);

/** Interactive starts share restoration and foreground command checkpoints with ordinary commands. */
export async function readyInteractiveMachine({
  store,
  provider,
  workspace,
}: WorkspaceProviderStepInput): Promise<Option.Option<LiveMachineRow>> {
  const input = { store, provider, workspace };

  if (!(await advanceWorkspace(input))) {
    return Option.none();
  }

  await observeMachine(input);

  const now = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(now, INTERACTIVE_WAIT);

  if (!(await advanceToIdleExecution({ ...input, deadline }))) {
    return Option.none();
  }

  return await readyWorkspaceMachine({ ...input, deadline });
}
