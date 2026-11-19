export const gitTransferMigrationSql = `
ALTER TABLE mechane.managed_work
  ADD COLUMN git_claim_hash text,
  ADD COLUMN git_transferred_bytes bigint NOT NULL DEFAULT 0 CHECK (git_transferred_bytes>=0);
CREATE TABLE mechane.managed_git_transfers (
  id uuid PRIMARY KEY,
  work_id text NOT NULL REFERENCES mechane.managed_work(id) ON DELETE CASCADE,
  claim_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  maximum_bytes bigint NOT NULL CHECK (maximum_bytes>=0)
);`;
