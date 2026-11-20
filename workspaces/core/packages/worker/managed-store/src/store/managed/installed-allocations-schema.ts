export const installedAllocationMigrationSql = `
CREATE TABLE mechane.managed_installed_allocations (
  workspace_id uuid NOT NULL,
  environment_id text NOT NULL,
  session_id text NOT NULL,
  work_id text NOT NULL,
  lease_id text NOT NULL,
  generation bigint NOT NULL CHECK (generation BETWEEN 1 AND 9007199254740991),
  next_check_at timestamptz NOT NULL DEFAULT now(),
  release_started_at timestamptz,
  released_at timestamptz,
  CHECK (released_at IS NULL OR release_started_at IS NOT NULL),
  PRIMARY KEY (workspace_id,session_id)
);
CREATE INDEX managed_installed_allocations_due ON mechane.managed_installed_allocations(next_check_at)
 WHERE released_at IS NULL;
`;
