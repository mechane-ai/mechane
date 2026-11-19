import { createManagedAgentRuntime } from '@mechane/runtime';
import { Schema } from 'effect';
import type { ManagedRequest } from './types.ts';

type Services = Pick<ManagedRequest, 'store' | 'actors' | 'configuration' | 'wakeInstalledSession'>;
type SessionAccess = Services & Pick<ManagedRequest, 'scope'>;

const WireObject = Schema.Record(Schema.String, Schema.Unknown);

const RuntimeFields = Schema.Struct({
  model: Schema.Struct({ id: Schema.NonEmptyString }),
  system: Schema.NullOr(Schema.String),
  tools: Schema.Array(WireObject),
  mcp_servers: Schema.Array(WireObject),
  multiagent: Schema.NullOr(WireObject),
});

export async function bindSessionRuntime(
  { store, scope, actors, wakeInstalledSession }: SessionAccess,
  sessionId: string,
) {
  const target = { scope, id: sessionId };
  const catalog = store.managed.sessions;
  const binding = await catalog.runtimeBinding(target);
  const runtime = createManagedAgentRuntime(actors, { workspaceId: scope.workspaceId, agentId: binding.agentId });
  const targetRuntime = { runtime, environmentId: binding.environmentId };
  const pending = binding.pendingOpen;

  if (pending === null) {
    return targetRuntime;
  }

  const fields = Schema.decodeUnknownSync(RuntimeFields)(pending.agent);

  await runtime.open({
    sessionId,
    creatorId: pending.creatorId,
    createdAt: pending.createdAt,
    threadId: pending.threadId,
    runtimeMechId: pending.runtimeMechId,
    childRuntimeMechIds: pending.childRuntimeMechIds,
    environmentId: pending.environmentId,
    model: fields.model.id,
    system: fields.system ?? '',
    memoryInstructions: pending.memoryInstructions,
    skillInstructions: pending.skillInstructions.primary,
    childSkillInstructions: pending.skillInstructions.children,
    tools: fields.tools,
    agent: pending.agent,
    multiagent: fields.multiagent,
    mcpServers: fields.mcp_servers,
    initialEvents: pending.initialEvents,
  });
  wakeInstalledSession({ workspaceId: pending.workspaceId, environmentId: pending.environmentId, sessionId });
  await catalog.confirmOpen(target);

  return targetRuntime;
}

export async function getSessionRuntime(input: SessionAccess, sessionId: string) {
  const { runtime } = await bindSessionRuntime(input, sessionId);

  return runtime;
}

export async function resumePendingSessions({
  maxRows,
  ...services
}: Services & { readonly maxRows: number }): Promise<void> {
  const pending = await services.store.managed.sessions.listPendingOpen({ maxRows });
  const failures: Array<unknown> = [];

  for (const { scope, id } of pending) {
    try {
      await getSessionRuntime({ ...services, scope }, id);
    } catch (failure) {
      failures.push(failure);
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, 'Unable to open pending managed sessions');
  }
}
