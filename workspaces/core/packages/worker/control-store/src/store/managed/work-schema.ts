import { environmentMigrationSql } from './environment-schema.ts';
import { gitTransferMigrationSql } from './git-transfer-schema.ts';

export const workerMigrationSql = `${environmentMigrationSql}
CREATE TABLE mechane.managed_work (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL,
  environment_id text NOT NULL,
  session_id text NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','starting','active','stopping','stopped')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  installation_owned boolean NOT NULL DEFAULT false,
  polled_at timestamptz,
  acknowledged_at timestamptz,
  started_at timestamptz,
  latest_heartbeat_at timestamptz,
  stop_requested_at timestamptz,
  stopped_at timestamptz,
  token_hash text UNIQUE,
  lease_id text,
  effects_exposed boolean NOT NULL DEFAULT false,
  lease_until timestamptz,
  FOREIGN KEY (workspace_id,environment_id) REFERENCES mechane.managed_environments(workspace_id,id)
);
CREATE TABLE mechane.managed_worker_polls (
  environment_id text NOT NULL REFERENCES mechane.managed_environments(id) ON DELETE CASCADE,
  worker_id text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(environment_id,worker_id)
);
CREATE INDEX managed_work_queue ON mechane.managed_work(workspace_id,environment_id,created_at,id)
 WHERE stopped_at IS NULL;
CREATE UNIQUE INDEX managed_work_one_open_per_session ON mechane.managed_work(workspace_id,session_id)
 WHERE stopped_at IS NULL;
${gitTransferMigrationSql}
`;
