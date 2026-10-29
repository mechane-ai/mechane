import type { SourceId } from '@mechane/records';
import { ExecutionId, SOURCE_FINALIZE_TIMEOUT } from '@mechane/sandbox-wire';
import type { ExecutionProgress } from '@mechane/sandbox-wire';
import { Duration } from 'effect';
import { runExecution } from '../executions/run-execution.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';
import type { SourceCheckpointKind } from './constants.ts';

type RunSourceCheckpointInput = WorkspaceProviderStepInput & {
  readonly sourceId: SourceId;
  readonly kind: SourceCheckpointKind;
};

/** Reuses the source operation's execution id while polling its no-op and durable workspace checkpoint. */
export async function runSourceCheckpoint({
  store,
  provider,
  workspace,
  sourceId,
  kind,
}: RunSourceCheckpointInput): Promise<ExecutionProgress> {
  const executionName = `source-${kind}-${sourceId}`;
  const executionId = ExecutionId.make(executionName);
  const wait = Duration.seconds(1);
  const request = { executionId, command: 'true', timeout: SOURCE_FINALIZE_TIMEOUT, wait };

  return await runExecution({ store, provider, workspace, request });
}
