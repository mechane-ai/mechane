export const pluggableSandboxMigrationSql = `
ALTER TABLE mechane.managed_installed_allocations
  ADD COLUMN provider text NOT NULL DEFAULT 'cloudflare',
  ADD COLUMN provider_sandbox_id text,
  ADD COLUMN snapshot_id text;

CREATE TABLE mechane.managed_session_evidence (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL,
  session_id text NOT NULL,
  turn_id text,
  kind text NOT NULL CHECK (kind IN ('screenshot','recording')),
  media_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  sha256 text NOT NULL,
  r2_key text NOT NULL,
  width integer,
  height integer,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id,session_id) REFERENCES mechane.managed_sessions(workspace_id,id) ON DELETE CASCADE
);

CREATE INDEX managed_session_evidence_session_created
  ON mechane.managed_session_evidence(workspace_id,session_id,created_at DESC,id DESC);
`;
