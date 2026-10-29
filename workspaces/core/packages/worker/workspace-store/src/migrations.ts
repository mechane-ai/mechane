import type { Migration } from '@mechane/store';

/**
 * The workspace database's schema steps in order, after the ledger that records them; append a step, and never edit one
 * that has shipped. The dispatches table is the ledger of every model request of the workspace's mechs, which decides
 * each one against its workspace's allowance and its mech's cap.
 */
export const MIGRATIONS: ReadonlyArray<Migration> = [
  ({ sql }) => {
    sql.exec(
      'CREATE TABLE mechs (id TEXT PRIMARY KEY, name TEXT NOT NULL, model TEXT NOT NULL, creator_id TEXT NOT NULL, created_at_ms INTEGER NOT NULL, forked_from TEXT) STRICT',
    );
    // `committed_micros` is what a dispatch commits of its day's allowance, which every sum of a day reads: its
    // settlement once settled, its reservation while open, and nothing once refused.
    sql.exec(
      "CREATE TABLE dispatches (id TEXT PRIMARY KEY, mech_id TEXT NOT NULL, work_id TEXT NOT NULL, model TEXT NOT NULL, day TEXT NOT NULL, requested_micros INTEGER NOT NULL, status TEXT NOT NULL, decided_at_ms INTEGER NOT NULL, settled_micros INTEGER, basis TEXT, input_tokens INTEGER, output_tokens INTEGER, cache_read_tokens INTEGER, cache_write_tokens INTEGER, settled_at_ms INTEGER, committed_micros INTEGER GENERATED ALWAYS AS (CASE status WHEN 'settled' THEN settled_micros WHEN 'reserved' THEN requested_micros ELSE 0 END) VIRTUAL, CHECK ((settled_micros IS NULL) = (settled_at_ms IS NULL) AND (settled_micros IS NULL) = (basis IS NULL)), CHECK ((input_tokens IS NULL) = (output_tokens IS NULL) AND (input_tokens IS NULL) = (cache_read_tokens IS NULL) AND (input_tokens IS NULL) = (cache_write_tokens IS NULL)), CHECK (input_tokens IS NULL OR settled_micros IS NOT NULL)) STRICT",
    );
    sql.exec('CREATE INDEX dispatches_by_day ON dispatches (day, status)');
    sql.exec('CREATE INDEX dispatches_by_work ON dispatches (mech_id, work_id, decided_at_ms)');
    // The machines the workspace's sandboxes may run at once, one lease per sandbox, keyed by its mech's or drone's id.
    sql.exec('CREATE TABLE leases (sandbox_id TEXT PRIMARY KEY, expires_at_ms INTEGER NOT NULL) STRICT');
  },
  ({ sql }) => {
    sql.exec('ALTER TABLE mechs ADD COLUMN revision INTEGER NOT NULL DEFAULT 1');
    sql.exec("ALTER TABLE mechs ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
    sql.exec(
      'CREATE TABLE mech_creation_intents (request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, seed TEXT NOT NULL) STRICT',
    );
  },
  ({ sql }) => {
    sql.exec(
      'CREATE TABLE remote_connections (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, secret_reference TEXT, allowed_tools TEXT NOT NULL, policy TEXT NOT NULL, created_at_ms INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL) STRICT',
    );
    sql.exec(
      'CREATE TABLE mech_tool_grants (mech_id TEXT NOT NULL REFERENCES mechs(id), connection_id TEXT NOT NULL REFERENCES remote_connections(id), tools TEXT NOT NULL, PRIMARY KEY (mech_id, connection_id)) STRICT',
    );
  },
  ({ sql }) => {
    sql.exec(
      'CREATE TABLE slack_bindings (id TEXT PRIMARY KEY, connection_id TEXT NOT NULL, team_id TEXT NOT NULL, channel_id TEXT NOT NULL, mech_id TEXT NOT NULL UNIQUE REFERENCES mechs(id), binding TEXT NOT NULL, UNIQUE (connection_id, team_id, channel_id)) STRICT',
    );
    sql.exec(
      'CREATE TABLE slack_events (connection_id TEXT NOT NULL, event_id TEXT NOT NULL, team_id TEXT NOT NULL, channel_id TEXT NOT NULL, message_timestamp TEXT NOT NULL, inbox_item_id TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL, binding TEXT NOT NULL, PRIMARY KEY (connection_id, event_id), UNIQUE (connection_id, team_id, channel_id, message_timestamp)) STRICT',
    );
  },
];
