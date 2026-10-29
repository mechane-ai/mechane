import type { Migration } from '@mechane/store';

/**
 * A key cache shard's schema steps in order, after the ledger that records them; append a step, and never edit one that
 * has shipped. A row is a key the directory resolved with its principal and their workspaces, or a revocation's
 * tombstone, which holds nothing else when no fill came first. Tokens are stored only as SHA-256 hashes.
 */
export const MIGRATIONS: ReadonlyArray<Migration> = [
  ({ sql }) => {
    sql.exec(
      'CREATE TABLE cached_keys (token_hash TEXT PRIMARY KEY, key_id TEXT, key_name TEXT, purpose TEXT, created_at_ms INTEGER, expires_at_ms INTEGER, principal_id TEXT, principal_name TEXT, workspace_ids TEXT, revoked_at_ms INTEGER, CHECK (revoked_at_ms IS NOT NULL OR key_id IS NOT NULL)) STRICT',
    );
  },
];
