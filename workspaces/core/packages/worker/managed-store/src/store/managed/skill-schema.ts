export const skillMigrationSql = `
CREATE TABLE mechane.managed_skills (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES mechane.workspaces(id),
  creator_id uuid NOT NULL REFERENCES mechane.principals(id),
  name text NOT NULL,
  display_name text NOT NULL,
  latest_version_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX managed_skills_visible ON mechane.managed_skills(workspace_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;
CREATE TABLE mechane.managed_skill_versions (
  id text PRIMARY KEY,
  skill_id text NOT NULL REFERENCES mechane.managed_skills(id),
  ordinal integer NOT NULL CHECK (ordinal > 0),
  description text NOT NULL,
  archive bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(skill_id, ordinal),
  UNIQUE(skill_id, id)
);
ALTER TABLE mechane.managed_skills ADD FOREIGN KEY (id, latest_version_id)
  REFERENCES mechane.managed_skill_versions(skill_id, id) DEFERRABLE INITIALLY DEFERRED;
`;
