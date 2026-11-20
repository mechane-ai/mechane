import { EvidenceArtifactId } from '@mechane/records';
import { Result, Schema } from 'effect';
import { listQuery, listQueryFields } from './list-query.ts';
import type { ListQuery } from './list-query.ts';
import { ManagedId } from './managed-records.ts';
import { restoreRecord } from './records.ts';

const READ_KIND = {
  Agents: 'agents',
  Agent: 'agent',
  Attention: 'attention',
  ManagedEnvironments: 'managedEnvironments',
  Sessions: 'sessions',
  Session: 'session',
  Threads: 'threads',
  SessionEvents: 'sessionEvents',
  SessionEvidence: 'sessionEvidence',
  SessionArtifact: 'sessionArtifact',
} as const;

/** Stable identity for one declared endpoint and cursor. */
export const ReadId = Schema.String.pipe(Schema.brand('ConsoleReadId'));
type ReadId = typeof ReadId.Type;

const PageCursor = Schema.NullOr(Schema.String);

const ReadTarget = Schema.Union([
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Agents), ...listQueryFields('agents'), page: PageCursor }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Agent), agentId: ManagedId }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Attention), agentId: ManagedId }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.ManagedEnvironments), page: PageCursor }),
  Schema.Struct({
    kind: Schema.Literal(READ_KIND.Sessions),
    ...listQueryFields('sessions'),
    agentId: ManagedId,
    page: PageCursor,
  }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Session), agentId: ManagedId, sessionId: ManagedId }),
  Schema.Struct({
    kind: Schema.Literal(READ_KIND.Threads),
    agentId: ManagedId,
    sessionId: ManagedId,
    page: PageCursor,
  }),
  Schema.Struct({
    kind: Schema.Literal(READ_KIND.SessionEvents),
    agentId: ManagedId,
    sessionId: ManagedId,
    threadId: Schema.NullOr(ManagedId),
    page: PageCursor,
    through: PageCursor,
    isStatusOnly: Schema.Boolean,
  }),
  Schema.Struct({
    kind: Schema.Literal(READ_KIND.SessionEvidence),
    ...listQueryFields('sessionEvidence'),
    agentId: ManagedId,
    sessionId: ManagedId,
    after: Schema.NullOr(EvidenceArtifactId),
  }),
  Schema.Struct({
    kind: Schema.Literal(READ_KIND.SessionArtifact),
    agentId: ManagedId,
    sessionId: ManagedId,
    artifactId: EvidenceArtifactId,
  }),
]);

type ReadTarget = typeof ReadTarget.Type;
const EncodedReadTarget = Schema.fromJsonString(ReadTarget);

const ReadKind = Schema.Enum(READ_KIND);
/** The fixed API reads supported by the console's exact receipt source. */
export type ReadKind = typeof ReadKind.Type;

/** A declared endpoint and cursor whose serialized identity names one exact demand. */
export type ReadRequest<Kind extends ReadKind = ReadKind> = Extract<ReadTarget, { readonly kind: Kind }> & {
  readonly id: ReadId;
};

export type TabReadKind = 'sessionEvents' | 'attention';

export const isTabRead = Schema.is(
  Schema.Struct({ kind: Schema.Literals([READ_KIND.Attention, READ_KIND.SessionEvents]) }),
);

export const isManagedDetail = Schema.is(
  Schema.Struct({ kind: Schema.Literals([READ_KIND.Agent, READ_KIND.Session]) }),
);

export const isSessionEvidenceRead = Schema.is(
  Schema.Struct({ kind: Schema.Literals([READ_KIND.SessionEvidence, READ_KIND.SessionArtifact]) }),
);

/** Ordered membership for one successful API read, including successful empty results. */
export const ReadReceipt = Schema.Struct({
  id: Schema.toEncoded(ReadId),
  kind: ReadKind,
  keys: Schema.Array(Schema.String),
  nextPage: Schema.optionalKey(Schema.NullOr(Schema.String)),
  /** Null means the endpoint does not expose pagination metadata. */
  hasMore: Schema.NullOr(Schema.Boolean),
}).check(
  Schema.makeFilter(
    (receipt) => {
      const target = Schema.decodeUnknownResult(EncodedReadTarget)(receipt.id);

      return Result.isSuccess(target) && target.success.kind === receipt.kind;
    },
    { expected: 'a receipt matching its declared read' },
  ),
);

export type ReadReceipt = typeof ReadReceipt.Type;

function request<Target extends ReadTarget>(target: Target): Target & { readonly id: ReadId } {
  return { ...target, id: ReadId.make(JSON.stringify(target)) };
}

/** Builds stable read identities before runtime creation or during route navigation. */
export const readRequests = {
  attention: (agentId: string) => request({ kind: READ_KIND.Attention, agentId }),
  agents: (page: string | null = null, query?: ListQuery) =>
    request({ kind: READ_KIND.Agents, page, ...listQuery('agents', query) }),
  agent: (agentId: string) => request({ kind: READ_KIND.Agent, agentId }),
  managedEnvironments: (page: string | null = null) => request({ kind: READ_KIND.ManagedEnvironments, page }),
  sessions: (agentId: string, page: string | null = null, query?: ListQuery) =>
    request({ kind: READ_KIND.Sessions, agentId, page, ...listQuery('sessions', query) }),
  session: (agentId: string, sessionId: string) => request({ kind: READ_KIND.Session, agentId, sessionId }),
  threads: (agentId: string, sessionId: string, page: string | null = null) =>
    request({ kind: READ_KIND.Threads, agentId, sessionId, page }),
  sessionEvents: (
    target: { readonly agentId: ManagedId; readonly sessionId: ManagedId; readonly threadId: ManagedId | null },
    page: string | null = null,
    through: string | null = null,
  ) =>
    request({
      kind: READ_KIND.SessionEvents,
      agentId: target.agentId,
      sessionId: target.sessionId,
      threadId: target.threadId,
      page,
      through,
      isStatusOnly: false,
    }),
  sessionEvidence: (
    { agentId, sessionId }: { readonly agentId: ManagedId; readonly sessionId: ManagedId },
    after: string | null = null,
    query?: ListQuery,
  ) =>
    request({
      kind: READ_KIND.SessionEvidence,
      ...listQuery('sessionEvidence', query),
      agentId,
      sessionId,
      after: after === null ? null : EvidenceArtifactId.make(after),
    }),
  sessionArtifact: (agentId: string, sessionId: string, artifactId: string) =>
    request({ kind: READ_KIND.SessionArtifact, agentId, sessionId, artifactId: EvidenceArtifactId.make(artifactId) }),
  sessionStatus: (agentId: string, sessionId: string) =>
    request({
      kind: READ_KIND.SessionEvents,
      agentId,
      sessionId,
      threadId: null,
      page: null,
      through: null,
      isStatusOnly: true,
    }),
} as const;

/** Rejects stored identities that do not name one of the declared endpoint demands. */
export function decodeReadRequest(id: string): ReadRequest {
  const target = restoreRecord(EncodedReadTarget, id);

  return { ...target, id: ReadId.make(id) };
}

/** Every capture page for the session may hold this artifact, including a response still in flight. */
export function isArtifactRead({
  candidate,
  artifact,
}: {
  readonly candidate: ReadRequest;
  readonly artifact: ReadRequest<'sessionArtifact' | 'sessionEvidence'>;
}): boolean {
  if (!isSessionEvidenceRead(candidate)) {
    return false;
  }

  if (candidate.agentId !== artifact.agentId || candidate.sessionId !== artifact.sessionId) {
    return false;
  }

  return artifact.kind === 'sessionEvidence' || candidate.kind === 'sessionEvidence' || candidate.id === artifact.id;
}
