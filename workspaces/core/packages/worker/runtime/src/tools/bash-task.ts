import type { Context } from '@earendil-works/chord/context';
import { defineDoc, defineTask } from '@earendil-works/pi-durable';
import type { ToolExecutionApi } from '@earendil-works/pi-durable';
import { toolExecutionId as executionId } from '@mechane/records';
import { MACHINE_STARTUP_GRACE_MS } from '@mechane/sandbox-wire';
import type { ActorAccess } from '../actor/types.ts';
import type { BashResult } from './bash-result.schemas.ts';
import { executeBash, observeBash } from './bash.ts';
import { joinReceiptTask, withReceiptTaskOwner } from './receipt-task.ts';
import type { ReceiptJoin, ReceiptTaskControl } from './receipt-task.ts';
import type { BashInvocation } from './types.ts';

type BashInput = BashInvocation & ReceiptTaskControl;
type BashPhase = { readonly phase: 'submit' } | { readonly phase: 'observe' };
const BASH_RECEIPT_POLL_MS = 500;

const Join = defineDoc<ReceiptJoin<BashResult>>({
  kind: 'mechane.bash-join',
  version: 1,
  scope: 'task',
  initial: () => ({ taskId: null, digest: null }),
  checkpointWhen: () => true,
});

export function createBashExecutionTask(getAccess: () => ActorAccess) {
  async function step(input: BashInput, isSubmit: boolean, context: Context): Promise<BashResult> {
    const access = getAccess();

    return await withReceiptTaskOwner(
      {
        access,
        generationTaskId: input.generationTaskId,
        runId: input.runId,
        run: async () => {
          if (isSubmit) {
            return await executeBash(input);
          }

          return await observeBash({ ...input, executionId: await executionId(input) });
        },
      },
      context,
    );
  }

  return defineTask<BashInput, BashPhase, BashResult>({
    name: 'mechane.bash-execution',
    version: 1,
    initial: () => ({ phase: 'submit' }),
    phases: {
      submit: async (task, runtime, context) => {
        const result = await step(task.input, true, context);

        if (result.status === 'running') {
          await runtime.sleepUntil(runtime.now() + BASH_RECEIPT_POLL_MS, { phase: 'observe' }, context);
        } else {
          await runtime.commit(() => ({ status: 'terminal', outcome: { status: 'completed', result } }), context);
        }
      },
      observe: async (task, runtime, context) => {
        const result = await step(task.input, false, context);

        if (result.status === 'running' && runtime.now() < task.input.deadlineAt) {
          await runtime.sleepUntil(runtime.now() + BASH_RECEIPT_POLL_MS, { phase: 'observe' }, context);
        } else {
          let retained: BashResult = result;

          if (result.status === 'running') {
            retained = {
              ...result,
              status: 'uncertain',
              message:
                'The command remains owned by its original receipt. Inspect bash_status before issuing another command.',
            };
          }

          await runtime.commit(
            () => ({ status: 'terminal', outcome: { status: 'completed', result: retained } }),
            context,
          );
        }
      },
    },
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
