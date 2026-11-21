import type { createConsoleManagedClient } from '@mechane/client/managed';
import { Bytes } from '@mechane/records';
import { Schema } from 'effect';

type Client = ReturnType<typeof createConsoleManagedClient>;
type SessionApi = Client['beta']['sessions'];
type Agent = Awaited<ReturnType<Client['beta']['agents']['retrieve']>>;
type ManagedFileWire = Awaited<ReturnType<Client['beta']['files']['retrieveMetadata']>>;
type Session = Awaited<ReturnType<SessionApi['retrieve']>>;
type Thread = Awaited<ReturnType<SessionApi['threads']['retrieve']>>;
type SessionEvent = Awaited<ReturnType<SessionApi['events']['list']>>['data'][number];

// Managed Agents defines its resource IDs as opaque, non-empty strings.
export const ManagedId = Schema.NonEmptyString;
export type ManagedId = typeof ManagedId.Type;

const nullableText = Schema.NullOr(Schema.String);

const SessionStatus = {
  Running: 'running',
  Idle: 'idle',
  Rescheduling: 'rescheduling',
  Terminated: 'terminated',
} as const;

const MessageType = { User: 'user.message', Agent: 'agent.message', System: 'system.message' } as const;
const isPublicMessage = Schema.is(Schema.Struct({ type: Schema.Enum(MessageType) }));
const Permission = { Ask: 'ask', Allow: 'allow', Deny: 'deny' } as const;
const status = Schema.Enum(SessionStatus);
const TOOL_DESCRIPTION_MAX_CHARS = 512;

export const ManagedAgent = Schema.Struct({
  id: ManagedId,
  archivedAt: Schema.optionalKey(nullableText),
  name: Schema.String,
  description: nullableText,
  model: Schema.String,
  version: Schema.Int,
  updatedAt: Schema.String,
});

export type ManagedAgent = typeof ManagedAgent.Type;

export const ManagedEnvironment = Schema.Struct({ id: ManagedId, name: Schema.String, updatedAt: Schema.String });
export type ManagedEnvironment = typeof ManagedEnvironment.Type;

export const ManagedFile = Schema.Struct({
  id: ManagedId,
  filename: Schema.String,
  mimeType: Schema.String,
  sizeBytes: Bytes,
  createdAt: Schema.String,
  isDownloadable: Schema.Boolean,
  expiresAt: nullableText,
  scopeId: Schema.NullOr(ManagedId),
});

export type ManagedFile = typeof ManagedFile.Type;

export const ManagedSession = Schema.Struct({
  id: ManagedId,
  archivedAt: Schema.optionalKey(nullableText),
  agentId: ManagedId,
  agentName: Schema.String,
  environmentId: ManagedId,
  title: nullableText,
  status,
  updatedAt: Schema.String,
});

export type ManagedSession = typeof ManagedSession.Type;

export const ManagedThread = Schema.Struct({
  id: ManagedId,
  sessionId: ManagedId,
  name: Schema.String,
  parentThreadId: Schema.NullOr(ManagedId),
  status,
  updatedAt: Schema.String,
});

export type ManagedThread = typeof ManagedThread.Type;

export const ManagedEvent = Schema.Struct({
  id: ManagedId,
  type: Schema.String,
  text: Schema.String,
  processedAt: nullableText,
  threadId: Schema.NullOr(ManagedId),
  toolName: nullableText,
  stopReason: nullableText,
  pendingEventIds: Schema.Array(ManagedId),
  relatedEventId: Schema.NullOr(ManagedId),
  permission: Schema.NullOr(Schema.Enum(Permission)),
});

export type ManagedEvent = typeof ManagedEvent.Type;

export function projectAgent(agent: Agent): ManagedAgent {
  return {
    id: agent.id,
    archivedAt: agent.archived_at,
    name: agent.name,
    description: agent.description,
    model: agent.model.id,
    version: agent.version,
    updatedAt: agent.updated_at,
  };
}

export function projectFile(file: ManagedFileWire): ManagedFile {
  return {
    id: file.id,
    filename: file.filename,
    mimeType: file.mime_type,
    sizeBytes: Bytes.make(file.size_bytes),
    createdAt: file.created_at,
    isDownloadable: file.downloadable ?? true,
    expiresAt: file.expires_at ?? null,
    scopeId: file.scope?.id ?? null,
  };
}

export function projectSession(session: Session): ManagedSession {
  return {
    id: session.id,
    archivedAt: session.archived_at,
    agentId: session.agent.id,
    agentName: session.agent.name,
    environmentId: session.environment_id,
    title: session.title,
    status: session.status,
    updatedAt: session.updated_at,
  };
}

export function projectThread(thread: Thread): ManagedThread {
  return {
    id: thread.id,
    sessionId: thread.session_id,
    name: thread.agent.type === 'advisor' ? thread.agent.model : thread.agent.name,
    parentThreadId: thread.parent_thread_id,
    status: thread.status,
    updatedAt: thread.updated_at,
  };
}

function eventText(event: SessionEvent): string {
  if (event.type === 'session.error') {
    return event.error.message;
  }

  if (event.type === 'agent.tool_use' && event.name === 'bash' && typeof event.input['description'] === 'string') {
    return event.input['description'].slice(0, TOOL_DESCRIPTION_MAX_CHARS);
  }

  if (event.type === 'user.tool_confirmation') {
    return event.result;
  }

  if (isPublicMessage(event)) {
    return event.content
      .flatMap((block: { readonly type: string; readonly text?: string }) =>
        block.type === 'text' && typeof block.text === 'string' ? [block.text] : [],
      )
      .join('\n');
  }

  return '';
}

export function projectEvent(event: SessionEvent): ManagedEvent {
  const stop = 'stop_reason' in event ? event.stop_reason : null;

  const useId =
    'tool_use_id' in event
      ? event.tool_use_id
      : 'custom_tool_use_id' in event
        ? event.custom_tool_use_id
        : 'mcp_tool_use_id' in event
          ? event.mcp_tool_use_id
          : null;

  return {
    id: event.id,
    type: event.type,
    processedAt: event.processed_at ?? null,
    text: eventText(event),
    threadId: 'session_thread_id' in event ? (event.session_thread_id ?? null) : null,
    toolName:
      event.type === 'agent.mcp_tool_use'
        ? `${event.mcp_server_name} · ${event.name}`
        : 'name' in event
          ? event.name
          : null,
    stopReason: stop?.type ?? null,
    pendingEventIds: stop?.type === 'requires_action' ? stop.event_ids : [],
    relatedEventId: useId,
    permission: 'evaluated_permission' in event ? (event.evaluated_permission ?? null) : null,
  };
}
