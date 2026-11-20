export const sessionMigrationSql = `
CREATE TABLE mechane.managed_sessions (
  id text PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES mechane.workspaces(id),
  creator_id uuid NOT NULL REFERENCES mechane.principals(id),
  oidc_issuer text, oidc_subject text, CHECK((oidc_issuer IS NULL)=(oidc_subject IS NULL)),
  agent_id text NOT NULL, agent_version integer NOT NULL,
  environment_id text NOT NULL, runtime_mech_id uuid NOT NULL, thread_id text NOT NULL UNIQUE,
  child_runtime_mech_ids jsonb NOT NULL DEFAULT '{}', outcome_evaluations jsonb NOT NULL DEFAULT '[]',
  configuration jsonb NOT NULL CHECK(jsonb_typeof(configuration)='object'), initial_events jsonb CHECK(jsonb_typeof(initial_events)='array'),
  budget_cents numeric CHECK(budget_cents IS NULL OR (budget_cents>0 AND budget_cents=trunc(budget_cents))),
  status text NOT NULL CHECK(status IN ('running','idle','terminated')), status_sequence bigint NOT NULL DEFAULT -1,
  status_at timestamptz(3) NOT NULL DEFAULT now(), last_open_attempt_at timestamptz(3),
  created_at timestamptz(3) NOT NULL DEFAULT now(), updated_at timestamptz(3) NOT NULL DEFAULT now(), archived_at timestamptz(3),
  UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,agent_id) REFERENCES mechane.managed_agents(workspace_id,id),
  FOREIGN KEY(agent_id,agent_version) REFERENCES mechane.managed_agent_versions(agent_id,version),
  FOREIGN KEY(workspace_id,environment_id) REFERENCES mechane.managed_environments(workspace_id,id),
  FOREIGN KEY(workspace_id,runtime_mech_id) REFERENCES mechane.mechs(workspace_id,id)
);
CREATE INDEX managed_sessions_catalog ON mechane.managed_sessions(workspace_id,created_at DESC,id DESC);
CREATE INDEX managed_sessions_agent ON mechane.managed_sessions(workspace_id,agent_id,created_at DESC,id DESC);
CREATE INDEX managed_sessions_pending ON mechane.managed_sessions(last_open_attempt_at NULLS FIRST,created_at,id) WHERE initial_events IS NOT NULL;
CREATE TABLE mechane.managed_session_mutations (
  workspace_id uuid NOT NULL REFERENCES mechane.workspaces(id), session_id text NOT NULL,
  principal_id uuid NOT NULL REFERENCES mechane.principals(id), mutation_id text NOT NULL,
  fingerprint text NOT NULL, result jsonb NOT NULL CHECK(jsonb_typeof(result)='object'),
  PRIMARY KEY(workspace_id,session_id,mutation_id)
);
ALTER TABLE mechane.managed_work ADD FOREIGN KEY(workspace_id,session_id)
  REFERENCES mechane.managed_sessions(workspace_id,id) ON DELETE CASCADE;
`;
