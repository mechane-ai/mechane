import { ProcessHandle } from '@mechane/protocol';
import { EvidenceArtifactId, MechId, TurnId } from '@mechane/records';
import { Result, Schema } from 'effect';
import { restoreRecord } from './records.ts';

const READ_KIND = {
  Mechs: 'mechs',
  Mech: 'mech',
  Turns: 'turns',
  Trace: 'trace',
  Evidence: 'evidence',
  EvidenceArtifact: 'evidenceArtifact',
  EnvironmentProcesses: 'environmentProcesses',
  EnvironmentProcess: 'environmentProcess',
  TurnEvents: 'turnEvents',
  Events: 'events',
  Allowance: 'allowance',
} as const;

/** Stable identity for one declared endpoint and cursor. */
export const ReadId = Schema.String.pipe(Schema.brand('ConsoleReadId'));
type ReadId = typeof ReadId.Type;

const ReadTarget = Schema.Union([
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Mechs), after: Schema.NullOr(Schema.String) }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Mech), mechId: MechId }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Turns), mechId: MechId, after: Schema.NullOr(TurnId) }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Trace), mechId: MechId, turnId: TurnId }),
  Schema.Struct({
    kind: Schema.Literal(READ_KIND.Evidence),
    mechId: MechId,
    turnId: TurnId,
    after: Schema.NullOr(EvidenceArtifactId),
  }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.EvidenceArtifact), mechId: MechId, artifactId: EvidenceArtifactId }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.EnvironmentProcesses), mechId: MechId }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.EnvironmentProcess), mechId: MechId, handle: ProcessHandle.to }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.TurnEvents), mechId: MechId, turnId: TurnId, after: Schema.Number }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Events), mechId: MechId, before: Schema.NullOr(Schema.Number) }),
  Schema.Struct({ kind: Schema.Literal(READ_KIND.Allowance) }),
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

/** Ordered membership for one successful API read, including successful empty results. */
export const ReadReceipt = Schema.Struct({
  id: Schema.toEncoded(ReadId),
  kind: ReadKind,
  keys: Schema.Array(Schema.String),
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
  mechs: (after: string | null) => request({ kind: READ_KIND.Mechs, after }),
  mech: (mechId: string) => request({ kind: READ_KIND.Mech, mechId: MechId.make(mechId) }),
  turns: (mechId: string, after: TurnId | null) =>
    request({ kind: READ_KIND.Turns, mechId: MechId.make(mechId), after }),
  trace: (mechId: string, turnId: TurnId) => request({ kind: READ_KIND.Trace, mechId: MechId.make(mechId), turnId }),
  evidence: (mechId: string, turnId: TurnId, after: string | null) =>
    request({
      kind: READ_KIND.Evidence,
      mechId: MechId.make(mechId),
      turnId,
      after: after === null ? null : EvidenceArtifactId.make(after),
    }),
  evidenceArtifact: (mechId: string, artifactId: string) =>
    request({
      kind: READ_KIND.EvidenceArtifact,
      mechId: MechId.make(mechId),
      artifactId: EvidenceArtifactId.make(artifactId),
    }),
  environmentProcesses: (mechId: string) =>
    request({ kind: READ_KIND.EnvironmentProcesses, mechId: MechId.make(mechId) }),
  environmentProcess: (mechId: string, handle: ProcessHandle) =>
    request({ kind: READ_KIND.EnvironmentProcess, mechId: MechId.make(mechId), handle }),
  turnEvents: (mechId: string, turnId: TurnId, after: number) =>
    request({ kind: READ_KIND.TurnEvents, mechId: MechId.make(mechId), turnId, after }),
  events: (mechId: string, before: number | null) =>
    request({ kind: READ_KIND.Events, mechId: MechId.make(mechId), before }),
  allowance: () => request({ kind: READ_KIND.Allowance }),
} as const;

/** Rejects stored identities that do not name one of the declared endpoint demands. */
export function decodeReadRequest(id: string): ReadRequest {
  const target = restoreRecord(EncodedReadTarget, id);

  return { ...target, id: ReadId.make(id) };
}

/** Every capture page for the mech may hold this artifact, including a response still in flight. */
export function isArtifactRead({
  candidate,
  artifact,
}: {
  readonly candidate: ReadRequest;
  readonly artifact: ReadRequest<'evidenceArtifact'>;
}): boolean {
  if (candidate.kind === 'evidence') {
    return candidate.mechId === artifact.mechId;
  }

  return candidate.kind === 'evidenceArtifact' && candidate.id === artifact.id;
}
