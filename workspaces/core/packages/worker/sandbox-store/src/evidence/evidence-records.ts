import { EVIDENCE_PAGE_ARTIFACTS, EvidenceArtifact, EvidenceSha256 } from '@mechane/protocol';
import type { EvidencePage, EvidenceQuery } from '@mechane/protocol';
import { Bytes, EvidenceArtifactId } from '@mechane/records';
import { BrowserOperation, InstalledActionOrigin } from '@mechane/sandbox-wire';
import { decodeFirst, decodeOne, decodeRows } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option, Schema } from 'effect';

const ArtifactJson = Schema.fromJsonString(EvidenceArtifact);
const ArtifactRow = Schema.Struct({ record: ArtifactJson });

const OriginRow = Schema.Struct({
  artifactId: EvidenceArtifactId,
  origin: Schema.fromJsonString(InstalledActionOrigin),
});

const ArtifactIds = Schema.Array(EvidenceArtifactId);
const ArtifactIdsJson = Schema.fromJsonString(ArtifactIds);
type OriginsInput = { readonly artifactIds: typeof ArtifactIds.Type };
const UsageRow = Schema.Struct({ artifactCount: Schema.Int, sizeBytes: Bytes });

/** The receipt fixes a chunk's position, length, and digest before its retryable R2 write. */
export const EvidenceChunk = Schema.Struct({ offsetBytes: Bytes, sizeBytes: Bytes, sha256: EvidenceSha256 });
export type EvidenceChunk = typeof EvidenceChunk.Type;

type ArtifactInput = Pick<EvidenceArtifact, 'artifactId'>;
type CallInput = Pick<EvidenceArtifact, 'executionId' | 'turnId' | 'toolCallId'>;
type SaveInput = { readonly artifact: EvidenceArtifact };
type ChunkInput = ArtifactInput & { readonly chunk: EvidenceChunk };

/** Keeps immutable capture identities and byte receipts separate from replaceable workspace generations. */
export function evidenceRecords({ sql }: RecordsInput) {
  function evidenceArtifact({ artifactId }: ArtifactInput): Option.Option<EvidenceArtifact> {
    const cursor = sql.exec('SELECT record FROM evidence_artifacts WHERE id = ?', artifactId);
    const row = decodeFirst({ cursor, schema: ArtifactRow });

    return Option.map(row, ({ record }) => record);
  }

  function evidenceForCall({ executionId, turnId, toolCallId }: CallInput): Option.Option<EvidenceArtifact> {
    const runId = Option.getOrNull(turnId);

    const cursor = sql.exec(
      'SELECT record FROM evidence_artifacts WHERE execution_id = ? OR (run_id IS ? AND tool_call_id = ?)',
      executionId,
      runId,
      toolCallId,
    );

    const row = decodeFirst({ cursor, schema: ArtifactRow });

    return Option.map(row, ({ record }) => record);
  }

  function insertEvidenceArtifact({ artifact }: SaveInput): void {
    const record = Schema.encodeSync(ArtifactJson)(artifact);
    const runId = Option.getOrNull(artifact.turnId);

    sql.exec(
      'INSERT INTO evidence_artifacts (id, session_id, run_id, execution_id, tool_call_id, size_bytes, record) VALUES (?, ?, ?, ?, ?, 0, ?)',
      artifact.artifactId,
      artifact.sessionId,
      runId,
      artifact.executionId,
      artifact.toolCallId,
      record,
    );
  }

  function saveEvidenceArtifact({ artifact }: SaveInput): void {
    const record = Schema.encodeSync(ArtifactJson)(artifact);

    sql.exec('UPDATE evidence_artifacts SET record = ? WHERE id = ?', record, artifact.artifactId);
  }

  function evidenceArtifacts({ after, turnId, search, filter }: EvidenceQuery): EvidencePage {
    const selectedRun = Option.getOrNull(turnId);
    const cursorId = Option.getOrNull(after);
    const status = Option.fromUndefinedOr(filter).pipe(Option.getOrNull);
    const term = Option.fromUndefinedOr(search).pipe(Option.getOrNull);

    const cursor = sql.exec(
      `SELECT record FROM evidence_artifacts
       WHERE (?1 IS NULL OR run_id = ?1) AND (?2 IS NULL OR rowid > (
         SELECT rowid FROM evidence_artifacts WHERE id = ?2 AND (?1 IS NULL OR run_id = ?1)))
         AND (?3 IS NULL OR json_extract(record, '$.status') = ?3)
         AND (?4 IS NULL OR instr(lower(id || ' ' || json_extract(record, '$.kind') || ' ' ||
           coalesce(json_extract(record, '$.descriptor.url'), '')),lower(?4)) > 0)
       ORDER BY rowid LIMIT ?5`,
      selectedRun,
      cursorId,
      status,
      term,
      EVIDENCE_PAGE_ARTIFACTS + 1,
    );

    const rows = decodeRows({ cursor, schema: ArtifactRow });

    return {
      artifacts: rows.slice(0, EVIDENCE_PAGE_ARTIFACTS).map(({ record }) => record),
      hasMore: rows.length > EVIDENCE_PAGE_ARTIFACTS,
    };
  }

  /** Join through the allocating screenshot or recording start. Later steps may belong to different work. */
  function captureOrigins({
    artifactIds,
  }: OriginsInput): ReadonlyMap<EvidenceArtifactId, typeof InstalledActionOrigin.Type> {
    const ids = Schema.encodeSync(ArtifactIdsJson)(artifactIds);

    const cursor = sql.exec(
      `SELECT a.id AS artifactId, json_extract(b.record, '$.origin') AS origin
       FROM evidence_artifacts a JOIN browser_calls b ON b.id = a.id AND b.id = a.execution_id
       AND b.run_id = a.run_id AND json_extract(b.record,'$.sessionId') = a.session_id
       AND json_extract(b.record,'$.toolCallId') = a.tool_call_id
       WHERE a.id IN (SELECT value FROM json_each(?)) AND json_type(b.record, '$.origin') = 'object'
       AND json_extract(b.record,'$.request.action._tag') IN (?, ?)`,
      ids,
      BrowserOperation.Screenshot,
      BrowserOperation.RecordStart,
    );

    const rows = decodeRows({ cursor, schema: OriginRow });
    const origins = rows.map((row) => [row.artifactId, row.origin] as const);

    return new Map(origins);
  }

  function evidenceUsage(): typeof UsageRow.Type {
    const cursor = sql.exec(
      'SELECT COUNT(*) AS artifactCount, COALESCE(SUM(size_bytes), 0) AS sizeBytes FROM evidence_artifacts',
    );

    return decodeOne({ cursor, schema: UsageRow });
  }

  function evidenceChunks({ artifactId }: ArtifactInput): ReadonlyArray<EvidenceChunk> {
    const cursor = sql.exec(
      'SELECT offset_bytes AS offsetBytes, size_bytes AS sizeBytes, sha256 FROM evidence_chunks WHERE artifact_id = ? ORDER BY offset_bytes',
      artifactId,
    );

    return decodeRows({ cursor, schema: EvidenceChunk });
  }

  function insertEvidenceChunk({ artifactId, chunk }: ChunkInput): void {
    sql.exec(
      'INSERT INTO evidence_chunks (artifact_id, offset_bytes, size_bytes, sha256) VALUES (?, ?, ?, ?)',
      artifactId,
      chunk.offsetBytes,
      chunk.sizeBytes,
      chunk.sha256,
    );
    sql.exec('UPDATE evidence_artifacts SET size_bytes = size_bytes + ? WHERE id = ?', chunk.sizeBytes, artifactId);
  }

  return {
    evidenceArtifact,
    captureOrigins,
    evidenceForCall,
    insertEvidenceArtifact,
    saveEvidenceArtifact,
    evidenceArtifacts,
    evidenceUsage,
    evidenceChunks,
    insertEvidenceChunk,
  };
}
