import type { Context } from '@earendil-works/chord/context';
import { defineDoc, defineTask } from '@earendil-works/pi-durable';
import type { RunningTask, Task, TaskRuntime, ToolExecutionApi } from '@earendil-works/pi-durable';
import { toolExecutionId as executionId } from '@mechane/records';
import { Duration } from 'effect';
import type { ActorAccess } from '../../actor/types.ts';
import { isExecutionCurrent } from '../admission.ts';
import { joinReceiptTask, withReceiptTaskOwner } from '../receipt-task.ts';
import type { ReceiptJoin, ReceiptTaskControl } from '../receipt-task.ts';
import type { BrowserToolResult } from './browser-result.ts';
import { abandonBrowserExecution, browserToolName, executeBrowser, observeBrowser } from './browser.ts';
import type { BrowserInvocation } from './browser.ts';

type BrowserInput = BrowserInvocation & ReceiptTaskControl & { readonly isCleanup?: boolean };
type BrowserPhase = { readonly phase: 'reconcile' } | { readonly phase: 'abandon' } | { readonly phase: 'observe' };
type BrowserStep = { readonly result: BrowserToolResult; readonly isCleanupRequired: boolean };
const BROWSER_RECEIPT_POLL_MS = 500;
const BROWSER_OPERATION_TIMEOUT = Duration.minutes(5);

const Join = defineDoc<ReceiptJoin<BrowserToolResult>>({
  kind: 'mechane.browser-join',
  version: 1,
  scope: 'task',
  initial: () => ({ taskId: null, digest: null }),
  checkpointWhen: () => true,
});

function uncertainResult(result: BrowserToolResult): BrowserToolResult {
  return {
    ...result,
    progress: {
      _tag: 'Uncertain',
      reason: 'The browser action remains owned by its original receipt; inspect browser_status before new work',
    },
  };
}

export function createBrowserExecutionTask(getAccess: () => ActorAccess) {
  async function step(input: BrowserInput, hasExpired: () => boolean, context: Context): Promise<BrowserStep> {
    const access = getAccess();

    const result = await withReceiptTaskOwner(
      {
        access,
        ...input,
        toolName: browserToolName(input.action._tag),
        run: async () => await executeBrowser({ ...input, hasExpired }),
      },
      context,
    );

    if (result.progress._tag !== 'Pending' || !result.progress.isDispatchRequired) {
      return { result, isCleanupRequired: false };
    }

    const isCurrent = await isExecutionCurrent(
      { access, ...input, toolName: browserToolName(input.action._tag) },
      context,
    ).catch(() => false);

    if (!hasExpired() && isCurrent) {
      return { result, isCleanupRequired: false };
    }

    try {
      const abandoned = await withReceiptTaskOwner(
        {
          access,
          ...input,
          toolName: browserToolName(input.action._tag),
          run: async () => await abandonBrowserExecution(input),
        },
        context,
      );

      return { result: abandoned, isCleanupRequired: false };
    } catch {
      return { result: uncertainResult(result), isCleanupRequired: true };
    }
  }

  async function cleanup(
    current: RunningTask<BrowserInput, BrowserPhase, BrowserToolResult>,
    runtime: TaskRuntime<BrowserInput, BrowserPhase, BrowserToolResult, object>,
    context: Context,
  ): Promise<void> {
    try {
      const result = await withReceiptTaskOwner(
        {
          access: getAccess(),
          ...current.input,
          toolName: browserToolName(current.input.action._tag),
          run: async () => {
            if (current.state.checkpoint.phase === 'abandon') {
              return await abandonBrowserExecution(current.input);
            }

            return await observeBrowser({ ...current.input, executionId: await executionId(current.input) });
          },
        },
        context,
      );

      if (result.progress._tag === 'Pending') {
        await runtime.sleepUntil(runtime.now() + BROWSER_RECEIPT_POLL_MS, { phase: 'observe' }, context);

        return;
      }

      await runtime.commit(() => ({ status: 'terminal', outcome: { status: 'completed', result } }), context);
    } catch {
      await runtime.sleepUntil(runtime.now() + BROWSER_RECEIPT_POLL_MS, current.state.checkpoint, context);
    }
  }

  const task: Task<BrowserInput, BrowserPhase, BrowserToolResult, object> = defineTask<
    BrowserInput,
    BrowserPhase,
    BrowserToolResult
  >({
    name: 'mechane.browser-execution',
    version: 1,
    initial: (input) => {
      if (input.isCleanup === true) {
        return { phase: 'abandon' };
      }

      return { phase: 'reconcile' };
    },
    phases: {
      reconcile: async (current, runtime, context) => {
        const hasExpired: () => boolean = () => runtime.now() >= current.input.deadlineAt;
        const outcome = await step(current.input, hasExpired, context);

        if (outcome.isCleanupRequired) {
          await runtime.commit(async (transaction) => {
            await transaction.createTask(
              task,
              { ...current.input, isCleanup: true },
              { ownership: { kind: 'conversation' }, background: true },
            );

            return { status: 'terminal', outcome: { status: 'completed', result: outcome.result } };
          }, context);

          return;
        }

        if (outcome.result.progress._tag === 'Pending' && !hasExpired()) {
          const nextAt = Math.min(current.input.deadlineAt, runtime.now() + BROWSER_RECEIPT_POLL_MS);

          await runtime.sleepUntil(nextAt, { phase: 'reconcile' }, context);

          return;
        }

        const result: BrowserToolResult = (() => {
          if (outcome.result.progress._tag === 'Pending') {
            return uncertainResult(outcome.result);
          }

          return outcome.result;
        })();

        await runtime.commit(() => ({ status: 'terminal', outcome: { status: 'completed', result } }), context);
      },
      abandon: cleanup,
      observe: cleanup,
    },
    // The actor's saved cancellation receipt owns environment cancellation, including after native parent abort.
    abort: (_current, runtime, context) =>
      runtime.commit(() => ({ status: 'terminal', outcome: { status: 'aborted' } }), context),
  });

  return task;
}

export type BrowserExecutionTask = ReturnType<typeof createBrowserExecutionTask>;

export async function joinBrowser(
  input: {
    readonly task: BrowserExecutionTask;
    readonly invocation: BrowserInvocation;
    readonly api: ToolExecutionApi;
  },
  context: Context,
): Promise<BrowserToolResult> {
  return await joinReceiptTask(
    { ...input, join: Join, deadlineAt: () => input.api.now() + Duration.toMillis(BROWSER_OPERATION_TIMEOUT) },
    context,
  );
}
