export const agentMigrationSql = `
CREATE TABLE mechane.managed_agents (
  id text PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES mechane.workspaces(id),
  creator_id uuid NOT NULL REFERENCES mechane.principals(id), runtime_id uuid NOT NULL UNIQUE,
  version integer NOT NULL CHECK (version >= 1), created_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',now()),
  archived_at timestamptz, UNIQUE (workspace_id,id),
  FOREIGN KEY(workspace_id,runtime_id) REFERENCES mechane.mechs(workspace_id,id)
);
CREATE INDEX managed_agents_page ON mechane.managed_agents(workspace_id,created_at DESC,id DESC);
CREATE TABLE mechane.managed_agent_versions (
  agent_id text NOT NULL REFERENCES mechane.managed_agents(id), version integer NOT NULL CHECK (version >= 1),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition)='object'), updated_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',now()),
  PRIMARY KEY(agent_id,version)
);
ALTER TABLE mechane.managed_agents ADD FOREIGN KEY(id,version)
  REFERENCES mechane.managed_agent_versions(agent_id,version) DEFERRABLE INITIALLY DEFERRED;
`;
