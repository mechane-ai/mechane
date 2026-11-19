export const memoryMigrationSql = `
CREATE TABLE mechane.managed_memory_stores (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES mechane.workspaces(id),
  creator_id uuid NOT NULL REFERENCES mechane.principals(id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  archived_at timestamptz(3)
);
CREATE INDEX managed_memory_store_listing ON mechane.managed_memory_stores(workspace_id,created_at DESC,id DESC);
CREATE TABLE mechane.managed_memory_versions (
  memory_store_id text NOT NULL REFERENCES mechane.managed_memory_stores(id) ON DELETE CASCADE,
  id text NOT NULL,
  memory_id text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('created','modified','deleted')),
  path text COLLATE "C",
  content bytea,
  content_sha256 text,
  content_size_bytes integer,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  created_by jsonb NOT NULL,
  redacted_at timestamptz(3),
  redacted_by jsonb,
  PRIMARY KEY(memory_store_id,id),
  UNIQUE(memory_store_id,memory_id,id),
  CHECK ((content IS NULL) = (redacted_at IS NOT NULL OR operation = 'deleted')),
  CHECK ((content IS NULL) = (content_sha256 IS NULL)),
  CHECK ((content IS NULL) = (content_size_bytes IS NULL)),
  CHECK ((redacted_at IS NULL) = (redacted_by IS NULL)),
  CHECK ((redacted_at IS NULL) = (path IS NOT NULL))
);
CREATE INDEX managed_memory_version_listing ON mechane.managed_memory_versions(memory_store_id,created_at DESC,id DESC);
CREATE INDEX managed_memory_lineage ON mechane.managed_memory_versions(memory_store_id,memory_id,created_at DESC,id DESC);
CREATE TABLE mechane.managed_memories (
  memory_store_id text NOT NULL REFERENCES mechane.managed_memory_stores(id) ON DELETE CASCADE,
  id text NOT NULL,
  version_id text NOT NULL,
  path text COLLATE "C" NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(memory_store_id,id),
  UNIQUE(memory_store_id,path),
  FOREIGN KEY(memory_store_id,id,version_id)
    REFERENCES mechane.managed_memory_versions(memory_store_id,memory_id,id) DEFERRABLE INITIALLY DEFERRED
);
`;
