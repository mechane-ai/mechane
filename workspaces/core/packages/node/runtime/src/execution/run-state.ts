import type { ModelMessage } from 'ai';
import { getWorkflowMetadata } from 'workflow';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { wakeMech } from './admission.ts';
import { closeOutcomeStream } from './close-workflow-stream.ts';
import { stopActivation } from './stop-activation.ts';
import { terminalOutcome } from './terminal-outcome.ts';
import type { RunOutcome } from './types.ts';

const RUN_FAILURE_MESSAGES = {
  environment_checkpoint:
    'The environment checkpoint did not commit. Inspect the saved files and command receipts before continuing.',
  note_import:
    'The existing notes could not be copied into this environment. Their original records remain available; inspect environment access and import receipts before continuing.',
} as const;

type FinishRunInput = {
  readonly runId: string;
  readonly messages: ReadonlyArray<ModelMessage>;
  readonly presentedSequence: number;
  readonly checkpointSequence: number;
  readonly traceMessages: ReadonlyArray<ModelMessage>;
  readonly shouldContinue: boolean;
};

export async function claimRun(runId: string): Promise<'running' | 'queued' | 'terminal'> {
  'use step';

  const { workflowRunId } = getWorkflowMetadata();

  return await withRuntimeStore(async (store) => {
    await store.attachWorkflow({ runId, workflowId: workflowRunId });

    return await store.claimRun({ runId });
  });
}

export async function markEnvironmentCheckpointCommitted(runId: string): Promise<void> {
  'use step';

  await withRuntimeStore(async (store) => await store.markEnvironmentCheckpointCommitted({ runId }));
}

export async function finishRun({
  runId,
  messages,
  presentedSequence,
  checkpointSequence,
  traceMessages,
  shouldContinue,
}: FinishRunInput): Promise<RunOutcome> {
  'use step';

  const { run, outcome } = await withRuntimeStore(async (store) => {
    const result = await store.finishActivation({
      runId,
      presentedSequence,
      checkpointSequence,
      traceMessages,
      shouldContinue,
      modelMessages: messages,
      isEnvironmentCheckpointCommitted: true,
    });

    return { run: result.run, outcome: terminalOutcome(result.run) };
  });

  await wakeMech({ workspaceId: run.workspaceId, mechId: run.mechId });

  return outcome;
}

export async function failRun(runId: string, reason?: keyof typeof RUN_FAILURE_MESSAGES): Promise<RunOutcome> {
  'use step';

  const { workflowRunId } = getWorkflowMetadata();

  const { run, outcome, wasFinished } = await withRuntimeStore(async (store) => {
    if (reason !== undefined) {
      return await stopActivation({ store, runId, status: 'failed', error: RUN_FAILURE_MESSAGES[reason] });
    }

    return await stopActivation({ store, runId, status: 'failed' });
  });

  if (!wasFinished) {
    return outcome;
  }

  await closeOutcomeStream({ workflowId: workflowRunId, outcome });
  await wakeMech({ workspaceId: run.workspaceId, mechId: run.mechId });

  return outcome;
}

export async function readTerminalRun(runId: string): Promise<RunOutcome> {
  'use step';

  return await withRuntimeStore(async (store) => {
    const run = await store.getRun({ runId });

    if (run === null) {
      throw new Error('Run is unavailable');
    }

    return terminalOutcome(run);
  });
}

export async function closeRunStream(outcome: RunOutcome): Promise<void> {
  'use step';

  const { workflowRunId } = getWorkflowMetadata();

  await closeOutcomeStream({ workflowId: workflowRunId, outcome });
}
