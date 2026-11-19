import { defineTool } from '@earendil-works/pi-durable';
import type { Tx } from '@earendil-works/pi-durable';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { fingerprint } from '../../actor/state.ts';
import { pauseManagedBudget } from '../budget-resume.ts';
import { appendManagedEvent } from '../event-log/write.ts';
import { failManagedRequest } from '../failure.ts';
import { transition } from '../lifecycle.ts';
import type { ManagedWireObject } from '../protocol.ts';
import { ensureManagedSessionAvailable, queueInput, sessionState } from '../scheduler.ts';
import { requiredThread } from '../thread-records.ts';
import { requireCoordinatorTurn } from './active-turn.ts';
import { awaitFollowup } from './followup-fence.ts';
import { enqueueChild } from './inputs.ts';
import type { ManagedDelegationOrigin } from './protocol.ts';
import { Children, ToolCalls } from './records.ts';
import type { CoordinatorToolOptions } from './tool-options.ts';

const Task = Schema.Struct({ thread_id: Schema.NonEmptyString, message: Schema.NonEmptyString });

const Message = Schema.Struct({
  type: Schema.Literal('agent.thread_message_received'),
  from_session_thread_id: Schema.NonEmptyString,
  content: Schema.NonEmptyArray(Schema.Struct({ type: Schema.Literal('text'), text: Schema.NonEmptyString })),
});

type Dispatch = {
  readonly sessionId: string;
  readonly parentThreadId: string;
  readonly threadId: string;
  readonly agentName: string;
  readonly message: string;
};

export async function appendThreadDispatch(transaction: Tx, input: Dispatch) {
  const content = [{ type: 'text', text: input.message }];

  await appendManagedEvent(
    transaction,
    { sessionId: input.sessionId },
    {
      type: 'agent.thread_message_sent',
      to_session_thread_id: input.threadId,
      to_agent_name: input.agentName,
      content,
    },
  );

  return await appendManagedEvent(
    transaction,
    { sessionId: input.sessionId, threadId: input.threadId },
    { type: 'agent.thread_message_received', from_session_thread_id: input.parentThreadId, content },
  );
}

export function followupTool(options: CoordinatorToolOptions) {
  return defineTool({
    name: 'send_to_thread',
    description: 'Send a follow-up to an existing delegated thread. The agent keeps its conversation and can reply.',
    parameters: {
      type: 'object',
      required: ['thread_id', 'message'],
      additionalProperties: false,
      properties: { thread_id: { type: 'string' }, message: { type: 'string', minLength: 1 } },
    },
    executionMode: 'sequential',
    replay: 'safe',
    execute: async (args, api, context) => {
      const task = Schema.decodeUnknownSync(Task)(args);
      const digest = await fingerprint(task);

      await options.identity(context.abortSignal, () =>
        options.harness().commit(async (transaction) => {
          const state = await sessionState(transaction, options.sessionId);
          const receipt = await transaction.doc(ToolCalls, JSON.stringify([state.id, String(api.taskId)]), null);

          if (receipt.threadId !== '') {
            if (receipt.digest !== digest) {
              failManagedRequest(HttpStatusCode.Conflict, 'Thread message changed on retry');
            }

            return;
          }

          await requireCoordinatorTurn(transaction, state);

          const child = await Children.read(transaction, task.thread_id);

          if (child === undefined) {
            failManagedRequest(HttpStatusCode.NotFound, 'Delegated thread not found');
          }

          const sameSession = child.origin.sessionId === state.id && child.origin.parentThreadId === state.threadId;

          const sameOwner =
            child.origin.workspaceId === options.scope.workspaceId && child.origin.agentId === options.scope.agentId;

          if (!sameSession || !sameOwner) {
            failManagedRequest(HttpStatusCode.NotFound, 'Delegated thread not found');
          }

          const thread = await requiredThread(transaction, state.id, task.thread_id);

          if (child.retirement !== 'live' || thread.archivedAt !== null || thread.status === 'terminated') {
            failManagedRequest(HttpStatusCode.BadRequest, 'The delegated thread has ended');
          }

          const received = await appendThreadDispatch(transaction, {
            sessionId: state.id,
            parentThreadId: state.threadId,
            threadId: thread.id,
            agentName: child.agentName,
            message: task.message,
          });

          await awaitFollowup(transaction, thread.id, received.id);
          await enqueueChild(transaction, thread.id, received);

          receipt.digest = digest;
          receipt.threadId = thread.id;
        }, context),
      );
      options.wake();

      return { output: [{ type: 'text', text: task.thread_id }] };
    },
  });
}

export async function acceptFollowup(
  transaction: Tx,
  origin: ManagedDelegationOrigin,
  { event, isBudgetReached }: { readonly event: ManagedWireObject; readonly isBudgetReached: boolean },
) {
  const input = Schema.decodeUnknownSync(Message)(event);

  if (input.from_session_thread_id !== origin.parentThreadId) {
    failManagedRequest(HttpStatusCode.BadRequest, 'The message sender does not own this delegated thread');
  }

  await ensureManagedSessionAvailable(transaction, origin.threadId);

  const state = await sessionState(transaction, origin.threadId);

  if (state.isArchived || state.status === 'terminated') {
    failManagedRequest(HttpStatusCode.BadRequest, 'This thread has ended');
  }

  const admitted = await appendManagedEvent(transaction, { sessionId: state.id }, input);

  const isIdle = state.activeEvent === null && state.waiting === null;

  if (isIdle && isBudgetReached && !state.isBudgetReached) {
    await pauseManagedBudget(transaction, state.id);
  }

  await queueInput(transaction, state.id, admitted.id);

  if (state.waiting === null && state.interrupt === null && !state.isBudgetReached) {
    await transition(transaction, { sessionId: state.id, status: 'running' });
  }

  return admitted;
}
