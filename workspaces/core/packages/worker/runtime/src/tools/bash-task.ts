import type { Context } from '@earendil-works/chord/context';
import { defineDoc, defineTask } from '@earendil-works/pi-durable';
import type { RunningTask, TaskRuntime, ToolExecutionApi } from '@earendil-works/pi-durable';
import { toolExecutionId as executionId, HttpMethod } from '@mechane/records';
import { MACHINE_STARTUP_GRACE_MS } from '@mechane/sandbox-wire';
import type { ActorAccess } from '../actor/types.ts';
import type { BashResult } from './bash-result.schemas.ts';
import { executeBash, observeBash } from './bash.ts';
import { joinReceiptTask, withReceiptTaskOwner } from './receipt-task.ts';
import type { ReceiptJoin, ReceiptTaskControl } from './receipt-task.ts';
import { SandboxExecutionUnconfirmedError } from './sandbox-client.ts';
import type { BashInvocation } from './types.ts';

type BashInput = BashInvocation & ReceiptTaskControl;
type BashPhase = { readonly phase: 'submit' } | { readonly phase: 'observe' };
type BashStepInput = { readonly input: BashInput; readonly phase: BashPhase['phase']; readonly hasExpired: boolean };
const BASH_RECEIPT_POLL_MS = 500;

const Join = defineDoc<ReceiptJoin<BashResult>>({
  kind: 'mechane.bash-join',
  version: 1,
  scope: 'task',
  initial: () => ({ taskId: null, digest: null }),
  checkpointWhen: () => true,
});

export function createBashExecutionTask(getAccess: () => ActorAccess) {
  async function step({ input, phase, hasExpired }: BashStepInput, context: Context): Promise<BashResult | BashPhase> {
    const access = getAccess();

    try {
      const result = await withReceiptTaskOwner(
        {
          access,
          generationTaskId: input.generationTaskId,
          runId: input.runId,
          toolName: 'bash',
          run: async () => {
            if (phase === 'submit' && !hasExpired) {
              return await executeBash(input);
            }

            return await observeBash({ ...input, executionId: await executionId(input) });
          },
        },
        context,
      );

      if (result.status === 'running') {
        return { phase: 'observe' };
      }

      return result;
    } catch (error) {
      if (!(error instanceof SandboxExecutionUnconfirmedError)) {
        throw error;
      }

      // An unreadable preflight GET has sent no command on this attempt.
      if (phase === 'submit' && error.method === HttpMethod.Get) {
        return { phase: 'submit' };
      }

      return { phase: 'observe' };
    }
  }

  async function advance(
    task: RunningTask<BashInput, BashPhase, BashResult>,
    runtime: TaskRuntime<BashInput, BashPhase, BashResult, object>,
    context: Context,
  ): Promise<void> {
    const { input, state } = task;
    const hasExpired = runtime.now() >= input.deadlineAt;
    const result = await step({ input, phase: state.checkpoint.phase, hasExpired }, context);

    if ('status' in result) {
      await runtime.commit(() => ({ status: 'terminal', outcome: { status: 'completed', result } }), context);

      return;
    }

    const now = runtime.now();

    if (now < input.deadlineAt) {
      const nextAt = Math.min(input.deadlineAt, now + BASH_RECEIPT_POLL_MS);

      await runtime.sleepUntil(nextAt, result, context);

      return;
    }

    const retained: BashResult = {
      status: 'uncertain',
      executionId: await executionId(input),
      message: 'The command remains owned by its original receipt. Inspect bash_status before issuing another command.',
    };

    await runtime.commit(() => ({ status: 'terminal', outcome: { status: 'completed', result: retained } }), context);
  }

  return defineTask<BashInput, BashPhase, BashResult>({
    name: 'mechane.bash-execution',
    version: 1,
    initial: () => ({ phase: 'submit' }),
    phases: { submit: advance, observe: advance },
    abort: (_task, runtime, context) =>
      runtime.commit(() => ({ status: 'terminal', outcome: { status: 'aborted' } }), context),
  });
}

export type BashExecutionTask = ReturnType<typeof createBashExecutionTask>;

export async function hasBashJoin(api: ToolExecutionApi, context: Context): Promise<boolean> {
  const join = await api.snapshot(Join, api.taskId, context);

  return join?.taskId !== undefined && join.taskId !== null;
}

export async function joinBash(
  input: { readonly task: BashExecutionTask; readonly invocation: BashInvocation; readonly api: ToolExecutionApi },
  context: Context,
): Promise<BashResult> {
  return await joinReceiptTask(
    { ...input, join: Join, deadlineAt: () => Date.now() + input.invocation.timeoutMs + MACHINE_STARTUP_GRACE_MS },
    context,
  );
}
