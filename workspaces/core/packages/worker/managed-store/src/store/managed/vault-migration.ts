export const vaultMigrationSql = `
CREATE TABLE mechane.managed_vaults (
  id text PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES mechane.workspaces(id),
  creator_id uuid NOT NULL REFERENCES mechane.principals(id), display_name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(metadata)='object'),
  created_at timestamptz(3) NOT NULL DEFAULT now(), updated_at timestamptz(3) NOT NULL DEFAULT now(), archived_at timestamptz(3),
  UNIQUE(workspace_id,id)
);
CREATE INDEX managed_vaults_page ON mechane.managed_vaults(workspace_id,created_at DESC,id DESC);
CREATE TABLE mechane.managed_vault_credentials (
  id text PRIMARY KEY, workspace_id uuid NOT NULL, vault_id text NOT NULL, display_name text,
  metadata jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(metadata)='object'),
  mcp_server_url text NOT NULL, key_version text NOT NULL, nonce text NOT NULL, ciphertext text NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT now(), updated_at timestamptz(3) NOT NULL DEFAULT now(), archived_at timestamptz(3),
  FOREIGN KEY(workspace_id,vault_id) REFERENCES mechane.managed_vaults(workspace_id,id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX managed_vault_credentials_active ON mechane.managed_vault_credentials(vault_id,mcp_server_url) WHERE archived_at IS NULL;
CREATE INDEX managed_vault_credentials_page ON mechane.managed_vault_credentials(vault_id,created_at DESC,id DESC);
CREATE TABLE mechane.managed_session_git_tokens (
  workspace_id uuid NOT NULL, session_id text NOT NULL, resource_id text NOT NULL, url text NOT NULL,
  key_version text NOT NULL, nonce text NOT NULL, ciphertext text NOT NULL, PRIMARY KEY(session_id,resource_id),
  FOREIGN KEY(workspace_id,session_id) REFERENCES mechane.managed_sessions(workspace_id,id) ON DELETE CASCADE
);
`;
