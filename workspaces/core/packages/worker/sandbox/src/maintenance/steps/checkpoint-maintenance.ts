import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import { ExecutionId, ExecutionProgress, SOURCE_FINALIZE_TIMEOUT } from '@mechane/sandbox-wire';
import { Duration, Option, Result } from 'effect';
import { PortableMaintenanceRefused } from '../../errors.ts';
import { runExecution } from '../../executions/run-execution.ts';
import type { PortableStepInput } from '../types.ts';

/** Uses a retry-stable no-op to commit the same snapshot and receipt path as normal commands. */
export async function checkpointMaintenance({ store, provider, workspace, job }: PortableStepInput): Promise<void> {
  const name = `maintenance-${job.id}`;
  const executionId = ExecutionId.make(name);
  const wait = Duration.seconds(1);
  const request = { executionId, command: 'true', timeout: SOURCE_FINALIZE_TIMEOUT, wait };
  const portable = Option.some(workspace);
  const progress = await runExecution({ store, provider, workspace: portable, request });

  if (ExecutionProgress.guards.Running(progress)) {
    return;
  }

  const source = store.workspace().head;

  if (!ExecutionProgress.guards.Exited(progress) || Option.isNone(source)) {
    const cause = new PortableMaintenanceRefused({ reason: 'maintenance could not commit the current workspace' });
    const failure = Result.fail(cause);

    return Result.getOrThrow(failure);
  }

  const archive = Option.some(source.value.archive);

  if (job.action === SandboxAction.Export) {
    store.savePortableMaintenance({ ...job, source, archive, phase: SandboxPhase.Copy });

    return;
  }

  store.savePortableMaintenance({ ...job, source, archive, phase: SandboxPhase.Create });
}
