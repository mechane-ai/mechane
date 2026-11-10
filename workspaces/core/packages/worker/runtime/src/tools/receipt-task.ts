import type { Context } from '@earendil-works/chord/context';
import type { Task, TaskDocToken, TaskId, ToolExecutionApi } from '@earendil-works/pi-durable';
import { fingerprint } from '../actor/state.ts';
import type { ActorAccess } from '../actor/types.ts';
import { toolStore } from '../execution/receipts.ts';
import { isExecutionCurrent } from './admission.ts';
import { withToolOwner } from './context.ts';

export type ReceiptJoin<Result> = { readonly taskId: TaskId<Result> | null; readonly digest: string | null };

export type ReceiptTaskControl = { readonly generationTaskId: TaskId; readonly deadlineAt: number };

type ReceiptPhase = { readonly phase: string };

type ReceiptOwnerInput<Result> = {
  readonly access: ActorAccess;
  readonly generationTaskId: TaskId;
  readonly runId: string;
  readonly run: () => Promise<Result>;
};

export async function withReceiptTaskOwner<Result>(
  { access, generationTaskId, runId, run }: ReceiptOwnerInput<Result>,
  context: Context,
): Promise<Result> {
  return await withToolOwner(
    {
      configuration: access.configuration,
      withStore: async (operation) =>
        await access.withControl((control) =>
          operation(
            toolStore(
              access,
              control,
              async (transaction) =>
                await isExecutionCurrent({ access, generationTaskId, runId, transaction }, context),
            ),
          ),
        ),
    },
    run,
  );
}

type ReceiptTaskInput<Input, Phase extends ReceiptPhase, Result> = {
  readonly task: Task<Input & ReceiptTaskControl, Phase, Result, object>;
  readonly invocation: Input;
  readonly api: ToolExecutionApi;
  readonly join: TaskDocToken<ReceiptJoin<Result>>;
  readonly deadlineAt: () => number;
};

export async function joinReceiptTask<Input, Phase extends ReceiptPhase, Result>(
  input: ReceiptTaskInput<Input, Phase, Result>,
  context: Context,
): Promise<Result> {
  const owner = await input.api.getTask(input.api.taskId, context);

  if (owner?.owner === undefined) {
    throw new Error('The receipt tool has no native generation owner');
  }

  const generationTaskId = owner.owner;
  const digest = await fingerprint(input.invocation);

  const child = await input.api.commit(async (transaction) => {
    const join = await transaction.doc(input.join, input.api.taskId);

    if (join.taskId !== null) {
      if (join.digest !== digest) {
        throw new Error('The native receipt identity has different immutable arguments');
      }

      return join.taskId;
    }

    const id = await transaction.createTask(
      input.task,
      { ...input.invocation, generationTaskId, deadlineAt: input.deadlineAt() },
      { ownership: { kind: 'task', taskId: input.api.taskId } },
    );

    join.taskId = id;
    join.digest = digest;

    return id;
  }, context);

  const settled = await input.api.waitForTask(child, context);

  if (settled.state.outcome.status !== 'completed') {
    throw new Error('The native receipt join did not complete');
  }

  return settled.state.outcome.result;
}
