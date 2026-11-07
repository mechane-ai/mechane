import { sleep } from 'workflow';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { executionId } from './execution-id.ts';
import type { RuntimeToolContext, ToolInvocation } from './types.ts';

type WaitInput = ToolInvocation & { readonly seconds: number; readonly reason: string };
type WaitResult = { readonly status: 'ready' | 'refused'; readonly message: string };

type WaitTransition =
  | { readonly status: 'waiting'; readonly input: WaitInput; readonly activityId: string }
  | { readonly status: 'running'; readonly input: RuntimeToolContext };

const MILLISECONDS_PER_SECOND = 1000;
const WAITABLE_RUN_STATUSES: ReadonlySet<string> = new Set(['running', 'waiting']);

export async function waitForWork(input: WaitInput): Promise<WaitResult> {
  const isWaiting = await beginWait(input);

  if (!isWaiting) {
    return { status: 'refused', message: 'The run is no longer active.' };
  }

  await sleep(input.seconds * MILLISECONDS_PER_SECOND);

  const isReady = await completeWait(input);

  if (!isReady) {
    return { status: 'refused', message: 'The run was stopped while it waited.' };
  }

  return { status: 'ready', message: 'The wait finished. Check the external result before claiming it completed.' };
}

async function beginWait(input: WaitInput): Promise<boolean> {
  'use step';

  const id = await executionId({ runId: input.runId, toolCallId: `wait:${input.toolCallId}` });

  return await transitionWait({ status: 'waiting', input, activityId: id });
}

async function completeWait(input: RuntimeToolContext): Promise<boolean> {
  'use step';

  return await transitionWait({ status: 'running', input });
}

async function transitionWait(transition: WaitTransition): Promise<boolean> {
  const { runId, workspaceId } = transition.input;

  return await withRuntimeStore((store) =>
    store.runInTransaction(async (transaction) => {
      const run = await transaction.getRun({ runId, workspaceId });

      if (run === null || run.cancelRequestedAt !== null || !WAITABLE_RUN_STATUSES.has(run.status)) {
        return false;
      }

      if (transition.status === 'running') {
        await transaction.markRunRunning({ runId });
      } else {
        await transaction.markRunWaiting({ runId });
        await transaction.appendActivity({
          id: transition.activityId,
          workspaceId,
          mechId: transition.input.mechId,
          runId,
          type: 'run.waiting',
          payload: { reason: transition.input.reason, seconds: transition.input.seconds },
        });
      }

      return true;
    }),
  );
}
