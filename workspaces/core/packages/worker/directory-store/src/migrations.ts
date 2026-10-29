import { decodeOne } from '@mechane/store';
import type { Migration } from '@mechane/store';
import { Schema } from 'effect';

/**
 * The directory database's schema steps in order, after the ledger that records them; append a step, and never edit one
 * that has shipped. Keys, poll tokens, browser sessions and sign-in states are stored only as SHA-256 hashes.
 */
export const MIGRATIONS: ReadonlyArray<Migration> = [
  ({ sql }) => {
    sql.exec(
      'CREATE TABLE principals (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at_ms INTEGER NOT NULL) STRICT',
    );
    sql.exec(
      'CREATE TABLE identities (provider TEXT NOT NULL, subject INTEGER NOT NULL, principal_id TEXT NOT NULL REFERENCES principals (id), created_at_ms INTEGER NOT NULL, PRIMARY KEY (provider, subject)) STRICT',
    );
    sql.exec(
      'CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, daily_allowance_micros INTEGER NOT NULL, created_at_ms INTEGER NOT NULL) STRICT',
    );
    sql.exec(
      'CREATE TABLE memberships (workspace_id TEXT NOT NULL REFERENCES workspaces (id), principal_id TEXT NOT NULL REFERENCES principals (id), role TEXT NOT NULL, created_at_ms INTEGER NOT NULL, PRIMARY KEY (principal_id, workspace_id)) STRICT',
    );
    sql.exec(
      'CREATE TABLE keys (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, principal_id TEXT NOT NULL REFERENCES principals (id), name TEXT NOT NULL, purpose TEXT NOT NULL, created_at_ms INTEGER NOT NULL, expires_at_ms INTEGER NOT NULL, revoked_at_ms INTEGER) STRICT',
    );
    sql.exec('CREATE INDEX keys_by_principal ON keys (principal_id)');
    sql.exec(
      'CREATE TABLE device_approvals (id TEXT PRIMARY KEY, user_code TEXT NOT NULL UNIQUE, poll_token_hash TEXT NOT NULL UNIQUE, purpose TEXT NOT NULL, key_name TEXT NOT NULL, key_lifetime_ms INTEGER NOT NULL, peer_address TEXT, peer_country TEXT, created_at_ms INTEGER NOT NULL, expires_at_ms INTEGER NOT NULL, approver_id TEXT REFERENCES principals (id), key_id TEXT REFERENCES keys (id), CHECK (key_id IS NULL OR approver_id IS NOT NULL)) STRICT',
    );
    sql.exec('CREATE INDEX device_approvals_by_expiry ON device_approvals (expires_at_ms)');
    sql.exec(
      'CREATE TABLE browser_sessions (token_hash TEXT PRIMARY KEY, github_user_id INTEGER NOT NULL, github_login TEXT NOT NULL, created_at_ms INTEGER NOT NULL, expires_at_ms INTEGER NOT NULL) STRICT',
    );
    sql.exec('CREATE INDEX browser_sessions_by_expiry ON browser_sessions (expires_at_ms)');
    sql.exec(
      'CREATE TABLE sign_ins (state_hash TEXT PRIMARY KEY, created_at_ms INTEGER NOT NULL, expires_at_ms INTEGER NOT NULL) STRICT',
    );
    sql.exec('CREATE INDEX sign_ins_by_expiry ON sign_ins (expires_at_ms)');
  },
  ({ sql }) => {
    // A larger directory needs a staged backfill before this startup migration can run.
    const maximumRows = 10_000;
    const countedRows = maximumRows + 1;

    const IdentityMigrationCounts = Schema.Struct({
      identities: Schema.Int.check(Schema.isLessThanOrEqualTo(maximumRows)),
      sessions: Schema.Int.check(Schema.isLessThanOrEqualTo(maximumRows)),
    });

    const cursor = sql.exec(
      'SELECT (SELECT COUNT(*) FROM (SELECT 1 FROM identities LIMIT ?)) AS identities, (SELECT COUNT(*) FROM (SELECT 1 FROM browser_sessions LIMIT ?)) AS sessions',
      countedRows,
      countedRows,
    );

    decodeOne({ cursor, schema: IdentityMigrationCounts });

    sql.exec(
      'CREATE TABLE principal_identities (provider TEXT NOT NULL, subject TEXT NOT NULL, principal_id TEXT NOT NULL REFERENCES principals (id), created_at_ms INTEGER NOT NULL, PRIMARY KEY (provider, subject)) STRICT',
    );
    sql.exec(
      'INSERT INTO principal_identities (provider, subject, principal_id, created_at_ms) SELECT provider, CAST(subject AS TEXT), principal_id, created_at_ms FROM identities',
    );
    sql.exec(
      'CREATE TABLE identity_sessions (token_hash TEXT PRIMARY KEY, provider TEXT NOT NULL, subject TEXT NOT NULL, name TEXT NOT NULL, created_at_ms INTEGER NOT NULL, expires_at_ms INTEGER NOT NULL) STRICT',
    );
    sql.exec('CREATE INDEX identity_sessions_by_expiry ON identity_sessions (expires_at_ms)');
    sql.exec(
      "INSERT INTO identity_sessions (token_hash, provider, subject, name, created_at_ms, expires_at_ms) SELECT token_hash, 'github', CAST(github_user_id AS TEXT), github_login, created_at_ms, expires_at_ms FROM browser_sessions",
    );
  },
  ({ sql }) => {
    sql.exec("ALTER TABLE workspaces ADD COLUMN kind TEXT NOT NULL DEFAULT 'personal'");
    sql.exec('ALTER TABLE workspaces ADD COLUMN creator_id TEXT REFERENCES principals (id)');
    sql.exec('CREATE INDEX memberships_by_workspace ON memberships (workspace_id)');
    sql.exec('CREATE INDEX principal_identities_by_principal ON principal_identities (principal_id)');
  },
];
