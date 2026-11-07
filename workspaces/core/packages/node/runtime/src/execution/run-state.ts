import type { ModelMessage, UIMessage } from 'ai';
import { getWorkflowMetadata } from 'workflow';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { wakeMech } from './admission.ts';
import { closeOutcomeStream } from './close-workflow-stream.ts';
import { readTerminalOutcome, runFailureMessage } from './terminal-outcome.ts';
import type { RunOutcome } from './types.ts';
import { readCompletedUIMessage } from './ui-stream.ts';

type FinishRunInput = {
  readonly runId: string;
  readonly inputMessage: UIMessage;
  readonly messages: ReadonlyArray<ModelMessage>;
  readonly reply: string;
};

export async function claimRun(runId: string): Promise<'running' | 'queued' | 'terminal'> {
  'use step';

  const { workflowRunId } = getWorkflowMetadata();

  return await withRuntimeStore(async (store) => {
    await store.attachWorkflow({ runId, workflowId: workflowRunId });

    return await store.claimRun({ runId });
  });
}

export async function finishRun({ runId, inputMessage, messages, reply }: FinishRunInput): Promise<RunOutcome> {
  'use step';

  const { workflowRunId } = getWorkflowMetadata();
  const assistant = await readCompletedUIMessage({ runId, workflowId: workflowRunId });
  const uiMessages = [inputMessage];

  if (assistant !== null) {
    uiMessages.push(assistant);
  }

  const { run, outcome } = await withRuntimeStore(async (store) => {
    const committed = await store.finishRun({
      runId,
      status: 'completed',
      reply,
      error: null,
      modelMessages: messages,
      uiMessages,
    });

    return { run: committed, outcome: await readTerminalOutcome({ store, run: committed }) };
  });

  await wakeMech({ workspaceId: run.workspaceId, mechId: run.mechId });

  return outcome;
}

export async function failRun(runId: string): Promise<RunOutcome> {
  'use step';

  const { workflowRunId } = getWorkflowMetadata();

  const { run, outcome } = await withRuntimeStore(async (store) => {
    const current = await store.getRun({ runId });

    if (current === null) {
      throw new Error('Run is unavailable');
    }

    const committed = await store.finishRun({
      runId,
      status: 'failed',
      reply: null,
      error: runFailureMessage(current.failureReason),
    });

    return { run: committed, outcome: await readTerminalOutcome({ store, run: committed }) };
  });

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

    return await readTerminalOutcome({ store, run });
  });
}

export async function closeRunStream(outcome: RunOutcome): Promise<void> {
  'use step';

  const { workflowRunId } = getWorkflowMetadata();

  await closeOutcomeStream({ workflowId: workflowRunId, outcome });
}
