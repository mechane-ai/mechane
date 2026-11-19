export const environmentMigrationSql = `
CREATE TABLE mechane.managed_environments (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES mechane.workspaces(id),
  creator_id uuid NOT NULL REFERENCES mechane.principals(id),
  name text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  updated_at timestamptz(3) NOT NULL DEFAULT now(),
  archived_at timestamptz(3),
  UNIQUE (workspace_id, id)
);
CREATE INDEX managed_environments_page ON mechane.managed_environments(workspace_id, created_at DESC, id DESC);
CREATE TABLE mechane.managed_environment_keys (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL,
  environment_id text NOT NULL,
  token_digest text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '365 days'),
  revoked_at timestamptz,
  FOREIGN KEY (workspace_id,environment_id) REFERENCES mechane.managed_environments(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX managed_environment_keys_binding ON mechane.managed_environment_keys(workspace_id, environment_id);
`;
