import { ConsoleSessionEvidenceArtifact } from '@mechane/protocol';
import { Schema } from 'effect';
import { ManagedId } from './managed-records.ts';

/** Capture metadata is shared by session list and viewer, even without a retained native run. */
export const SessionEvidenceRow = Schema.Struct({
  key: Schema.String,
  agentId: ManagedId,
  sessionId: ManagedId,
  value: Schema.toEncoded(ConsoleSessionEvidenceArtifact),
});

export type SessionEvidenceRow = typeof SessionEvidenceRow.Type;

export function decodeSessionEvidenceArtifact(row: SessionEvidenceRow): ConsoleSessionEvidenceArtifact {
  return restoreRecord(ConsoleSessionEvidenceArtifact, row.value);
}

/** Validates native stored values synchronously and restores the owning protocol representation. */
export function restoreRecord<Value, Encoded>(schema: Schema.Codec<Value, Encoded>, value: unknown): Value {
  // Native collection callbacks reject invalid stored rows before queries can render them.
  // ast-grep-ignore: defect-sites
  return Schema.decodeUnknownSync(schema)(value);
}
