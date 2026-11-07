import {
  boundedText,
  BrowserTabId,
  Bytes,
  EvidenceArtifactId,
  EvidenceMachineId,
  EvidenceProvenance,
  MechId,
  MediaType,
  ModelToolCallId,
  SessionId,
  SHA256_PATTERN,
  TurnId,
  wireStruct,
  WorkspaceId,
} from '@mechane/records';
import { ExecutionId } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { WireTime } from '../../schemas.ts';
import { EVIDENCE_ARTIFACT_MAX_BYTES, EVIDENCE_TEXT_MAX_BYTES, EvidenceKind, EvidenceStatus } from './constants.ts';

const EvidenceText = boundedText({ maxBytes: EVIDENCE_TEXT_MAX_BYTES });
/** The digest identifies exact stored bytes and detects changed upload replays. */
export const EvidenceSha256 = Schema.String.check(Schema.isPattern(SHA256_PATTERN));
export type EvidenceSha256 = typeof EvidenceSha256.Type;
/** Only these media types may be served from authenticated capture storage. */
export const EvidenceMediaType = Schema.Literals([MediaType.Png, MediaType.Jpeg, MediaType.Mp4]);
export type EvidenceMediaType = typeof EvidenceMediaType.Type;

/** Finalization fixes this descriptor before R2 verifies and publishes its full media. */
export const EvidenceDescriptor = wireStruct({
  fields: {
    machineId: EvidenceMachineId,
    path: EvidenceText,
    mediaType: EvidenceMediaType,
    sizeBytes: Bytes.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(EVIDENCE_ARTIFACT_MAX_BYTES)),
    sha256: EvidenceSha256,
    widthPixels: Schema.Int.check(Schema.isGreaterThan(0)),
    heightPixels: Schema.Int.check(Schema.isGreaterThan(0)),
    duration: Schema.DurationFromMillis,
    tabId: BrowserTabId,
    url: EvidenceText,
    capturedAt: WireTime,
    provenance: EvidenceProvenance,
  },
});

export type EvidenceDescriptor = typeof EvidenceDescriptor.Type;

/** The receipt survives machine loss; only ready receipts certify stored media availability. */
export const EvidenceArtifact = wireStruct({
  fields: {
    artifactId: EvidenceArtifactId,
    workspaceId: WorkspaceId,
    mechId: MechId,
    sessionId: SessionId,
    executionId: ExecutionId,
    toolCallId: ModelToolCallId,
    /** Absent only when a capture has no associated native run. */
    turnId: Schema.OptionFromNullOr(TurnId),
    kind: Schema.Enum(EvidenceKind),
    status: Schema.Enum(EvidenceStatus),
    createdAt: WireTime,
    /** Absent while the capture is pending. */
    completedAt: Schema.OptionFromNullOr(WireTime),
    /** Absent until the original capture has produced a fixed media descriptor. */
    descriptor: Schema.OptionFromNullOr(EvidenceDescriptor),
    /** Absent unless a pending capture has failed. */
    failureReason: Schema.OptionFromNullOr(EvidenceText),
  },
});

export type EvidenceArtifact = typeof EvidenceArtifact.Type;

/** Every artifact lookup remains scoped to its original workspace and mech. */
export const EvidencePath = wireStruct({
  fields: { workspaceId: WorkspaceId, mechId: MechId, artifactId: EvidenceArtifactId },
});

export type EvidencePath = typeof EvidencePath.Type;

/** The cursor advances through immutable receipts and may restrict results to one turn. */
export const EvidenceQuery = wireStruct({
  fields: {
    /** Absent on the first page. */
    after: Schema.OptionFromOptionalKey(EvidenceArtifactId),
    /** Absent when listing captures from every turn. */
    turnId: Schema.OptionFromOptionalKey(TurnId),
  },
});

export type EvidenceQuery = typeof EvidenceQuery.Type;

/** The cursor continues after the last listed artifact when more receipts remain. */
export const EvidencePage = wireStruct({
  fields: { artifacts: Schema.Array(EvidenceArtifact), hasMore: Schema.Boolean },
});

export type EvidencePage = typeof EvidencePage.Type;
