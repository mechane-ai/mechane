export const managedFilesMigrationSql = `
CREATE TABLE mechane.managed_files (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES mechane.workspaces(id),
  creator_id uuid NOT NULL REFERENCES mechane.principals(id),
  filename text NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 500),
  mime_type text NOT NULL CHECK (char_length(mime_type) BETWEEN 1 AND 255),
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  sha256 text NOT NULL,
  downloadable boolean NOT NULL DEFAULT true,
  r2_key text,
  content bytea,
  scope_type text CHECK (scope_type IN ('session')),
  scope_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  deleted_at timestamptz,
  CHECK (deleted_at IS NOT NULL OR r2_key IS NOT NULL OR content IS NOT NULL),
  CHECK ((scope_type IS NULL) = (scope_id IS NULL))
);
CREATE INDEX managed_files_visible ON mechane.managed_files(workspace_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX managed_files_scope ON mechane.managed_files(workspace_id, scope_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL AND scope_id IS NOT NULL;
`;
