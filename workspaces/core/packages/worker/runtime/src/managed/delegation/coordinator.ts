import type { Context } from '@earendil-works/chord/context';
import { defineTool } from '@earendil-works/pi-durable';
import type { ToolRegistration, Tx } from '@earendil-works/pi-durable';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { fingerprint } from '../../actor/state.ts';
import { failManagedRequest } from '../failure.ts';
import type { ManagedAgentScope, ManagedSessionOpen } from '../protocol.ts';
import { sessionState } from '../scheduler.ts';
import { registerManagedChild } from '../thread-registration.ts';
import { requireCoordinatorTurn } from './active-turn.ts';
import { appendThreadDispatch, followupTool } from './followup.ts';
import type { ManagedDelegationOrigin } from './protocol.ts';
import { ActiveChildren, Children, ToolCalls } from './records.ts';
import { decodeCoordinatorRoster } from './roster.ts';
import type { CoordinatorRoster } from './roster.ts';
import type { CoordinatorToolOptions } from './tool-options.ts';

const Task = Schema.Struct({ agent_id: Schema.NonEmptyString, message: Schema.NonEmptyString });
type Task = typeof Task.Type;

type Dispatch = {
  readonly scope: ManagedAgentScope;
  readonly sessionId: string;
  readonly nativeId: string;
  readonly roster: CoordinatorRoster;
  readonly task: Task;
};

async function delegate(transaction: Tx, input: Dispatch): Promise<string> {
  const state = await sessionState(transaction, input.sessionId);
  const pointer = await transaction.doc(ToolCalls, JSON.stringify([input.sessionId, input.nativeId]), null);
  const digest = await fingerprint(input.task);

  if (pointer.threadId !== '') {
    if (pointer.digest !== digest) {
      failManagedRequest(HttpStatusCode.Conflict, 'Delegated task changed on retry');
    }

    return pointer.threadId;
  }

  await requireCoordinatorTurn(transaction, state);

  const member = input.roster.agents.find((agent) => agent.id === input.task.agent_id);

  if (member === undefined) {
    failManagedRequest(HttpStatusCode.BadRequest, 'Agent is outside the pinned coordinator roster');
  }

  const runtimeMechId = input.roster.runtimeIds[member.id];

  if (runtimeMechId === undefined) {
    failManagedRequest(HttpStatusCode.BadRequest, 'The selected agent is unavailable');
  }

  const threadId = `sthr_${crypto.randomUUID().replaceAll('-', '')}`;

  const origin: ManagedDelegationOrigin = {
    ...input.scope,
    sessionId: state.id,
    parentThreadId: state.threadId,
    childAgentId: member.id,
    threadId,
    callId: input.nativeId,
  };

  const content = [{ type: 'text', text: input.task.message }];

  const child: ManagedSessionOpen = {
    sessionId: origin.sessionId,
    threadId,
    runtimeMechId,
    environmentId: state.environmentId,
    agent: member,
    creatorId: input.roster.creatorId,
    system: member.system ?? '',
    memoryInstructions: input.roster.memoryInstructions ?? '',
    skillInstructions: input.roster.childSkillInstructions?.[member.id] ?? '',
    model: member.model.id,
    tools: member.tools,
    mcpServers: member.mcp_servers,
    initialEvents: [{ type: 'user.message', content }],
  };

  await registerManagedChild(transaction, {
    sessionId: state.id,
    parentThreadId: state.threadId,
    threadId,
    agent: member,
  });
  await appendThreadDispatch(transaction, {
    sessionId: state.id,
    parentThreadId: state.threadId,
    threadId,
    agentName: member.name,
    message: input.task.message,
  });
  await Children.put(transaction, threadId, {
    origin,
    open: child,
    parentName: input.roster.ownerName,
    agentName: member.name,
    offset: 0,
    isOpened: false,
    retirement: 'live',
  });
  await ActiveChildren.put(transaction, threadId, threadId);

  pointer.digest = digest;
  pointer.threadId = threadId;

  return threadId;
}

export function coordinatorTools(options: CoordinatorToolOptions): ReadonlyArray<ToolRegistration> {
  if (options.roster === '') {
    return [];
  }

  const roster = decodeCoordinatorRoster(options.roster);

  return [
    defineTool({
      name: 'delegate_to_agent',
      description: `Send a task to a configured agent in a separate thread. Its report returns to this conversation. Available agents: ${roster.agents
        .map((agent) => `${agent.name} (${agent.id})`)
        .join(', ')}`,
      parameters: {
        type: 'object',
        required: ['agent_id', 'message'],
        additionalProperties: false,
        properties: {
          agent_id: { type: 'string', enum: roster.agents.map((agent) => agent.id) },
          message: { type: 'string', minLength: 1 },
        },
      },
      executionMode: 'sequential',
      replay: 'safe',
      execute: async (args, api, context: Context) => {
        const task = Schema.decodeUnknownSync(Task)(args);

        const threadId = await options.identity(context.abortSignal, () =>
          options
            .harness()
            .commit(
              (transaction) =>
                delegate(transaction, {
                  scope: options.scope,
                  sessionId: options.sessionId,
                  nativeId: String(api.taskId),
                  roster,
                  task,
                }),
              context,
            ),
        );

        options.wake();

        return { output: [{ type: 'text', text: threadId }] };
      },
    }),
    followupTool(options),
  ];
}
