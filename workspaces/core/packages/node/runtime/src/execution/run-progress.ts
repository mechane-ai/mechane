import type { ModelMessage } from 'ai';
import { executionId } from '../execution-id.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';

type RunProgress = {
  readonly runId: string;
  readonly messages: ReadonlyArray<ModelMessage>;
  readonly presentedSequence: number;
  readonly checkpointSequence: number;
  readonly traceMessages: ReadonlyArray<ModelMessage>;
};

type ToolActivity = {
  readonly runId: string;
  readonly toolCallId: string;
  readonly name: string;
  readonly status: 'running' | 'completed' | 'failed' | 'not_started';
  readonly durationMs?: number;
};

const TOOL_ACTIVITY_TYPES: Readonly<Record<ToolActivity['status'], string>> = {
  running: 'tool.started',
  completed: 'tool.completed',
  failed: 'tool.failed',
  not_started: 'tool.not_started',
};

export async function saveRunTrace({ runId, messages }: Pick<RunProgress, 'runId' | 'messages'>): Promise<void> {
  'use step';

  await withRuntimeStore(async (store) => await store.saveRunMessages({ runId, modelMessages: messages }));
}

export async function saveRunProgress({
  runId,
  messages,
  presentedSequence,
  checkpointSequence,
  traceMessages,
}: RunProgress): Promise<void> {
  'use step';

  await withRuntimeStore(
    async (store) =>
      await store.saveActivationCheckpoint({
        runId,
        modelMessages: messages,
        presentedSequence,
        checkpointSequence,
        traceMessages,
      }),
  );
}

export async function recordToolActivity(input: ToolActivity): Promise<void> {
  'use step';

  const toolCallId = `activity:${input.toolCallId}:${input.status}`;
  const id = await executionId({ runId: input.runId, toolCallId });
  const at = new Date().toISOString();
  const eventType = TOOL_ACTIVITY_TYPES[input.status];

  await withRuntimeStore(async (store) => {
    const run = await store.getRun({ runId: input.runId });

    if (run === null) {
      throw new Error('Run is unavailable');
    }

    await store.appendActivity({
      id,
      workspaceId: run.workspaceId,
      mechId: run.mechId,
      runId: run.id,
      type: eventType,
      payload: {
        toolCallId: input.toolCallId,
        name: input.name,
        status: input.status,
        at,
        durationMs: input.durationMs,
      },
    });
  });
}
