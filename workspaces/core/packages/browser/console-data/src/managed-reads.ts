import type { createConsoleManagedClient } from '@mechane/client/managed';
import {
  ConsoleSessionEvidenceArtifact,
  ConsoleSessionEvidencePage,
  consoleSessionEvidencePath,
} from '@mechane/protocol';
import type { WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { upsertRows } from './collections.ts';
import type { CanonicalCollection, CanonicalTables, CanonicalWriter } from './collections.ts';
import { isManagedResourceDenied, ManagedResourceMismatch, ManagedSessionUnavailable } from './managed-errors.ts';
import { ManagedId, projectAgent, projectEvent, projectSession, projectThread } from './managed-records.ts';
import type { ReadReceipt, ReadRequest } from './requests.ts';

export type ManagedClient = ReturnType<typeof createConsoleManagedClient>;

export type ManagedKind =
  | 'agent'
  | 'agents'
  | 'managedEnvironments'
  | 'sessions'
  | 'session'
  | 'threads'
  | 'sessionEvidence'
  | 'sessionArtifact';

export type ManagedAttention = Awaited<ReturnType<typeof loadManagedAttention>>;
export type ManagedHistoryPage = Awaited<ReturnType<typeof loadManagedHistory>>;

function attentionPath(agentId: ManagedId) {
  return `/agents/${encodeURIComponent(agentId)}/attention`;
}

export async function loadManagedAttention(
  client: ManagedClient,
  request: ReadRequest<'attention'>,
  signal: AbortSignal,
) {
  const wire = await client.get<unknown>(attentionPath(request.agentId), { signal });

  return await Schema.decodeUnknownPromise(
    Schema.Struct({ sessionId: Schema.NullOr(ManagedId), queuedSessionIds: Schema.Array(ManagedId) }),
  )(wire);
}

export async function loadManagedHistory(
  client: ManagedClient,
  request: ReadRequest<'sessionEvents'>,
  signal: AbortSignal,
) {
  await admitSession(client, request, signal);

  const pagination = request.page === null ? {} : { page: request.page };
  const options = { signal };

  const page =
    request.threadId === null
      ? await client.beta.sessions.events.list(
          request.sessionId,
          {
            ...pagination,
            order: 'desc',
            ...(request.through === null ? {} : { 'created_at[lte]': request.through }),
            ...(request.isStatusOnly
              ? {
                  limit: 1,
                  types: [
                    'session.status_running',
                    'session.status_idle',
                    'session.status_rescheduled',
                    'session.status_terminated',
                  ],
                }
              : {}),
          },
          options,
        )
      : await client.beta.sessions.threads.events.list(
          request.threadId,
          { ...pagination, session_id: request.sessionId },
          options,
        );

  // The thread endpoint uses chronological order and exposes only a forward page cursor.
  const ordered = request.threadId === null ? page.data : page.data.toReversed();
  const events = new Map(ordered.map((event) => [event.id, projectEvent(event)]));

  return { items: [...events.values()], nextPage: page.next_page };
}

export async function admitSession(
  client: ManagedClient,
  { agentId, sessionId }: { readonly agentId: ManagedId; readonly sessionId: ManagedId },
  signal: AbortSignal,
) {
  try {
    const session = await client.beta.sessions.retrieve(sessionId, {}, { signal });

    if (session.id !== sessionId || session.agent.id !== agentId) {
      throw new ManagedSessionUnavailable({ agentId, sessionId });
    }

    return session;
  } catch (error) {
    if (isManagedResourceDenied(error)) {
      throw new ManagedSessionUnavailable({ agentId, sessionId });
    }

    throw error;
  }
}

type ManagedRow = {
  readonly id: ManagedId;
  readonly updatedAt?: string;
  readonly version?: number;
  readonly archivedAt?: string | null;
};

function isCurrent(value: ManagedRow, previous: ManagedRow): boolean {
  if (typeof previous.archivedAt === 'string' && value.archivedAt !== previous.archivedAt) {
    return false;
  }

  if (
    previous.updatedAt !== undefined &&
    value.updatedAt !== undefined &&
    Date.parse(previous.updatedAt) > Date.parse(value.updatedAt)
  ) {
    return false;
  }

  return previous.version === undefined || value.version === undefined || previous.version <= value.version;
}

type ManagedReadInput = {
  readonly client: ManagedClient;
  readonly workspaceId: WorkspaceId;
  readonly request: ReadRequest<ManagedKind>;
  readonly signal: AbortSignal;
  readonly tables: CanonicalTables;
  readonly canList: (id: string) => boolean;
  readonly writeRows: CanonicalWriter;
};

export async function loadManagedRead({
  client,
  workspaceId,
  request,
  signal,
  tables,
  canList,
  writeRows,
}: ManagedReadInput): Promise<ReadReceipt> {
  async function save<T extends ManagedRow>(
    table: CanonicalCollection<{ readonly key: string; readonly value: T }>,
    values: ReadonlyArray<T>,
    nextPage?: string | null,
  ): Promise<ReadReceipt> {
    const rows = values.map((value) => {
      const key = request.kind === 'threads' ? JSON.stringify([request.sessionId, value.id]) : value.id;

      return { key, value };
    });

    await writeRows({
      signal,
      collections: [table],
      write: () => {
        upsertRows(
          table,
          rows.filter((row) => {
            const previous = table.get(row.key)?.value;

            return canList(row.value.id) && (previous === undefined || isCurrent(row.value, previous));
          }),
        );
      },
    });

    return {
      id: request.id,
      kind: request.kind,
      keys: rows.filter((row) => canList(row.value.id)).map((row) => row.key),
      hasMore: nextPage === undefined ? null : nextPage !== null,
      ...(nextPage === undefined ? {} : { nextPage }),
    };
  }

  const options = { signal };
  const pagination = 'page' in request && request.page !== null ? { page: request.page } : {};

  switch (request.kind) {
    case 'sessionEvidence':
    case 'sessionArtifact':
      return await loadSessionEvidence({ client, workspaceId, request, signal, tables, canList, writeRows });
    case 'agents': {
      const page = await client.beta.agents.list(pagination, options);

      return await save(tables.managedAgents, page.data.map(projectAgent), page.next_page);
    }
    case 'agent': {
      const agent = await client.beta.agents.retrieve(request.agentId, {}, options);

      if (agent.id !== request.agentId) {
        throw new ManagedResourceMismatch({});
      }

      return await save(tables.managedAgents, [projectAgent(agent)]);
    }
    case 'managedEnvironments': {
      const page = await client.beta.environments.list(pagination, options);

      return await save(
        tables.managedEnvironments,
        page.data.map((environment) => ({
          id: environment.id,
          name: environment.name,
          updatedAt: environment.updated_at,
        })),
        page.next_page,
      );
    }
    case 'sessions': {
      const page = await client.beta.sessions.list({ ...pagination, agent_id: request.agentId }, options);

      if (page.data.some((session) => session.agent.id !== request.agentId)) {
        throw new ManagedResourceMismatch({});
      }

      return await save(tables.managedSessions, page.data.map(projectSession), page.next_page);
    }
    case 'session': {
      const session = await admitSession(client, request, signal);

      return await save(tables.managedSessions, [projectSession(session)]);
    }
    case 'threads': {
      await admitSession(client, request, signal);

      const page = await client.beta.sessions.threads.list(request.sessionId, pagination, options);

      if (page.data.some((thread) => thread.session_id !== request.sessionId)) {
        throw new ManagedResourceMismatch({});
      }

      return await save(tables.managedThreads, page.data.map(projectThread), page.next_page);
    }
  }
}

async function loadSessionEvidence({
  client,
  workspaceId,
  request,
  signal,
  tables,
  canList,
  writeRows,
}: Omit<ManagedReadInput, 'request'> & {
  readonly request: ReadRequest<'sessionEvidence' | 'sessionArtifact'>;
}): Promise<ReadReceipt> {
  const path = consoleSessionEvidencePath({ workspaceId, ...request });
  const url = new URL(path, client.baseURL);

  if (request.kind === 'sessionEvidence' && request.after !== null) {
    url.searchParams.set('after', request.after);
  }

  const wire = await client.get<unknown>(url.href, { signal });

  const page =
    request.kind === 'sessionEvidence'
      ? await Schema.decodeUnknownPromise(ConsoleSessionEvidencePage)(wire)
      : { artifacts: [await Schema.decodeUnknownPromise(ConsoleSessionEvidenceArtifact)(wire)], hasMore: null };

  const { agentId, sessionId } = request;

  const rows = page.artifacts.map((artifact) => {
    if (
      artifact.workspaceId !== workspaceId ||
      (request.kind === 'sessionArtifact' && artifact.artifactId !== request.artifactId)
    ) {
      throw new ManagedResourceMismatch({});
    }

    if (
      artifact.origin !== undefined &&
      (artifact.origin.workspaceId !== workspaceId || artifact.origin.sessionId !== sessionId)
    ) {
      throw new ManagedResourceMismatch({});
    }

    return {
      agentId,
      sessionId,
      key: JSON.stringify([agentId, sessionId, artifact.artifactId]),
      value: Schema.encodeSync(ConsoleSessionEvidenceArtifact)(artifact),
    };
  });

  await writeRows({
    signal,
    collections: [tables.sessionEvidence],
    write: () => {
      for (const row of rows) {
        const previous = tables.sessionEvidence.get(row.key);

        if (canList(row.value.artifact_id) && (previous === undefined || previous.value.status === 'pending')) {
          upsertRows(tables.sessionEvidence, [row]);
        }
      }
    },
  });

  return {
    id: request.id,
    kind: request.kind,
    keys: rows.filter((row) => canList(row.value.artifact_id)).map((row) => row.key),
    hasMore: page.hasMore,
    nextPage: page.hasMore === true ? (rows.at(-1)?.value.artifact_id ?? null) : null,
  };
}
