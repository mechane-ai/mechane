import type { Context } from '@earendil-works/chord/context';
import { defineDoc, defineTask } from '@earendil-works/pi-durable';
import type { ToolExecutionApi } from '@earendil-works/pi-durable';
import { Duration } from 'effect';
import type { ActorAccess } from '../../actor/types.ts';
import { isExecutionCurrent } from '../admission.ts';
import { joinReceiptTask, withReceiptTaskOwner } from '../receipt-task.ts';
import type { ReceiptJoin, ReceiptTaskControl } from '../receipt-task.ts';
import type { ProcessToolResult } from './results.ts';
import { startProcess } from './start.ts';
import type { ProcessInvocation } from './start.ts';

type ProcessInput = ProcessInvocation & ReceiptTaskControl;
type ProcessPhase = { readonly phase: 'reconcile' };
const PROCESS_ADMISSION_POLL_MS = 500;
const PROCESS_ADMISSION_TIMEOUT = Duration.minutes(5);

const Join = defineDoc<ReceiptJoin<ProcessToolResult>>({
  kind: 'mechane.process-join',
  version: 1,
  scope: 'task',
  initial: () => ({ taskId: null, digest: null }),
  checkpointWhen: () => true,
});

export function createProcessAdmissionTask(getAccess: () => ActorAccess) {
  return defineTask<ProcessInput, ProcessPhase, ProcessToolResult>({
    name: 'mechane.process-admission',
    version: 1,
    initial: () => ({ phase: 'reconcile' }),
    phases: {
      reconcile: async (current, runtime, context) => {
        const access = getAccess();
        const hasExpired: () => boolean = () => runtime.now() >= current.input.deadlineAt;

        const result = await withReceiptTaskOwner(
          {
            access,
            ...current.input,
            toolName: 'start_process',
            run: async () => await startProcess({ ...current.input, hasExpired }),
          },
          context,
        );

        if (result.status === 'pending') {
          const isCurrent = await isExecutionCurrent({ access, ...current.input, toolName: 'start_process' }, context);

          if (!hasExpired() && isCurrent) {
            const nextAt = Math.min(current.input.deadlineAt, runtime.now() + PROCESS_ADMISSION_POLL_MS);

            await runtime.sleepUntil(nextAt, { phase: 'reconcile' }, context);

            return;
          }

          const retained: ProcessToolResult = {
            ...result,
            status: 'uncertain',
            message:
              'The original process start has no confirmed outcome. Inspect its identity before starting another.',
          };

          await runtime.commit(
            () => ({ status: 'terminal', outcome: { status: 'completed', result: retained } }),
            context,
          );

          return;
        }

        await runtime.commit(() => ({ status: 'terminal', outcome: { status: 'completed', result } }), context);
      },
    },
    abort: (_current, runtime, context) =>
      runtime.commit(() => ({ status: 'terminal', outcome: { status: 'aborted' } }), context),
  });
}

export type ProcessAdmissionTask = ReturnType<typeof createProcessAdmissionTask>;

export async function joinProcessAdmission(
  input: {
    readonly task: ProcessAdmissionTask;
    readonly invocation: ProcessInvocation;
    readonly api: ToolExecutionApi;
  },
  context: Context,
): Promise<ProcessToolResult> {
  return await joinReceiptTask(
    { ...input, join: Join, deadlineAt: () => input.api.now() + Duration.toMillis(PROCESS_ADMISSION_TIMEOUT) },
    context,
  );
}
