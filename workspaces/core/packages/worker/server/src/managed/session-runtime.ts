import { HttpStatusCode } from '@mechane/records';
import { createManagedAgentRuntime, ManagedRuntimeError } from '@mechane/runtime';
import { Schema } from 'effect';
import type { ManagedRequest } from './types.ts';

type ManagedAgentRuntime = ReturnType<typeof createManagedAgentRuntime>;

type Services = Pick<ManagedRequest, 'store' | 'sessions' | 'configuration' | 'wakeInstalledSession'>;
type SessionAccess = Services & Pick<ManagedRequest, 'scope'>;

const WireObject = Schema.Record(Schema.String, Schema.Unknown);

const RuntimeFields = Schema.Struct({
  model: Schema.Struct({ id: Schema.NonEmptyString }),
  system: Schema.NullOr(Schema.String),
  tools: Schema.Array(WireObject),
  mcp_servers: Schema.Array(WireObject),
  multiagent: Schema.NullOr(WireObject),
});

type OpenDescriptor = NonNullable<
  Awaited<ReturnType<ManagedRequest['store']['managed']['sessions']['runtimeBinding']>>['pendingOpen']
>;

type OpenSessionInput = {
  readonly runtime: ManagedAgentRuntime;
  readonly sessionId: string;
  readonly descriptor: OpenDescriptor;
  readonly wakeInstalledSession: ManagedRequest['wakeInstalledSession'];
};

async function openSessionObject({
  runtime,
  sessionId,
  descriptor,
  wakeInstalledSession,
}: OpenSessionInput): Promise<void> {
  const fields = Schema.decodeUnknownSync(RuntimeFields)(descriptor.agent);

  await runtime.open({
    sessionId,
    creatorId: descriptor.creatorId,
    createdAt: descriptor.createdAt,
    threadId: descriptor.threadId,
    runtimeMechId: descriptor.runtimeMechId,
    childRuntimeMechIds: descriptor.childRuntimeMechIds,
    environmentId: descriptor.environmentId,
    model: fields.model.id,
    system: fields.system ?? '',
    memoryInstructions: descriptor.memoryInstructions,
    skillInstructions: descriptor.skillInstructions.primary,
    childSkillInstructions: descriptor.skillInstructions.children,
    tools: fields.tools,
    agent: descriptor.agent,
    multiagent: fields.multiagent,
    mcpServers: fields.mcp_servers,
    initialEvents: descriptor.initialEvents,
    isArchived: descriptor.isArchived,
  });

  if (!descriptor.isArchived) {
    wakeInstalledSession({ workspaceId: descriptor.workspaceId, environmentId: descriptor.environmentId, sessionId });
  }
}

function isMissingSessionActor(error: unknown): boolean {
  return (
    error instanceof ManagedRuntimeError &&
    error.status === HttpStatusCode.NotFound &&
    error.message === 'Unknown managed session'
  );
}

function withLazyRecovery(runtime: ManagedAgentRuntime, reopen: () => Promise<void>): ManagedAgentRuntime {
  async function recover<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (!isMissingSessionActor(error)) {
        throw error;
      }

      await reopen();

      return await run();
    }
  }

  return {
    ...runtime,
    read: (input) => recover(() => runtime.read(input)),
    send: (input) => recover(() => runtime.send(input)),
    events: (input) => recover(() => runtime.events(input)),
    stream: (input) => recover(() => runtime.stream(input)),
    threads: (input) => recover(() => runtime.threads(input)),
    thread: (input) => recover(() => runtime.thread(input)),
    archiveThread: (input) => recover(() => runtime.archiveThread(input)),
    mutateSession: (input) => recover(() => runtime.mutateSession(input)),
  };
}

export async function bindSessionRuntime(
  { store, scope, sessions, wakeInstalledSession }: SessionAccess,
  sessionId: string,
) {
  const target = { scope, id: sessionId };
  const catalog = store.managed.sessions;
  const binding = await catalog.runtimeBinding(target);
  const raw = createManagedAgentRuntime(sessions, { workspaceId: scope.workspaceId, agentId: binding.agentId });
  const pending = binding.pendingOpen;

  if (pending !== null) {
    await openSessionObject({ runtime: raw, sessionId, descriptor: pending, wakeInstalledSession });
    await catalog.confirmOpen(target);

    return { runtime: raw, environmentId: binding.environmentId };
  }

  const runtime = withLazyRecovery(raw, async () => {
    const descriptor = await catalog.reopenDescriptor(target);

    await openSessionObject({ runtime: raw, sessionId, descriptor, wakeInstalledSession });
  });

  return { runtime, environmentId: binding.environmentId };
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
