import type { StoreContext } from '@mechane/authority-store';
import type { SandboxEvidenceMetadata } from '@mechane/sandbox-provider';

export type StoredSessionEvidence = SandboxEvidenceMetadata & { readonly r2Key: string };
type PutEvidenceInput = Omit<StoredSessionEvidence, 'createdAt'>;

type SessionEvidenceLookup = { readonly workspaceId: string; readonly sessionId: string; readonly artifactId: string };
type SessionEvidenceListInput = { readonly workspaceId: string; readonly sessionId: string; readonly maxRows: number };
type SessionEvidenceScope = { readonly workspaceId: string; readonly sessionId: string };

const EVIDENCE_COLUMNS = `
  id,workspace_id AS "workspaceId",session_id AS "sessionId",turn_id AS "turnId",kind,
  media_type AS "mediaType",size_bytes::float8 AS "sizeBytes",sha256,r2_key AS "r2Key",
  width,height,duration_ms AS "durationMs",to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"`;

export function createManagedEvidenceStore(context: StoreContext) {
  return {
    async put(input: PutEvidenceInput): Promise<StoredSessionEvidence> {
      const result = await context.client.query<StoredSessionEvidence>(
        `INSERT INTO mechane.managed_session_evidence
           (id,workspace_id,session_id,turn_id,kind,media_type,size_bytes,sha256,r2_key,width,height,duration_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO UPDATE
           SET sha256=excluded.sha256,size_bytes=excluded.size_bytes,r2_key=excluded.r2_key,
               width=excluded.width,height=excluded.height,duration_ms=excluded.duration_ms
           WHERE mechane.managed_session_evidence.workspace_id=excluded.workspace_id
             AND mechane.managed_session_evidence.session_id=excluded.session_id
         RETURNING ${EVIDENCE_COLUMNS}`,
        [
          input.id,
          input.workspaceId,
          input.sessionId,
          input.turnId,
          input.kind,
          input.mediaType,
          input.sizeBytes,
          input.sha256,
          input.r2Key,
          input.width,
          input.height,
          input.durationMs,
        ],
      );

      const row = result.rows[0];

      if (row === undefined) {
        throw new Error('Evidence artifact identifier belongs to a different session.');
      }

      return row;
    },
    async get({ workspaceId, sessionId, artifactId }: SessionEvidenceLookup): Promise<StoredSessionEvidence | null> {
      const result = await context.client.query<StoredSessionEvidence>(
        `SELECT ${EVIDENCE_COLUMNS}
           FROM mechane.managed_session_evidence
          WHERE workspace_id=$1 AND session_id=$2 AND id=$3`,
        [workspaceId, sessionId, artifactId],
      );

      return result.rows[0] ?? null;
    },
    async list({
      workspaceId,
      sessionId,
      maxRows,
    }: SessionEvidenceListInput): Promise<ReadonlyArray<StoredSessionEvidence>> {
      const result = await context.client.query<StoredSessionEvidence>(
        `SELECT ${EVIDENCE_COLUMNS}
           FROM mechane.managed_session_evidence
          WHERE workspace_id=$1 AND session_id=$2
          ORDER BY created_at DESC,id DESC LIMIT $3`,
        [workspaceId, sessionId, maxRows],
      );

      return result.rows;
    },
    async deleteBySession({ workspaceId, sessionId }: SessionEvidenceScope): Promise<ReadonlyArray<string>> {
      const result = await context.client.query<{ readonly r2Key: string }>(
        `DELETE FROM mechane.managed_session_evidence
          WHERE workspace_id=$1 AND session_id=$2
          RETURNING r2_key AS "r2Key"`,
        [workspaceId, sessionId],
      );

      return result.rows.map((row) => row.r2Key);
    },
  };
}
