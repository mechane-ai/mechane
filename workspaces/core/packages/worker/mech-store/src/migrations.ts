import type { Migration } from '@mechane/store';

/**
 * A mech's own schema steps in order, after the ledger that records them. Append a step, and never edit one that has
 * shipped. pi's tables share the database under their own prefix and migrate themselves. Each event is stored as `/v1`
 * serves it, so the event schemas follow both the append-only `/v1` rule and the stored-format rule.
 */
export const MIGRATIONS: ReadonlyArray<Migration> = [
  ({ sql }) => {
    // `mech` holds one row, the mech this object is.
    sql.exec(
      'CREATE TABLE mech (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL, model TEXT NOT NULL, instructions TEXT, creator_id TEXT NOT NULL, created_at_ms INTEGER NOT NULL, daily_cap_micros INTEGER NOT NULL, forked_from TEXT) STRICT',
    );
    sql.exec(
      'CREATE TABLE turns (id TEXT PRIMARY KEY, status TEXT NOT NULL, started_at_ms INTEGER NOT NULL, ended_at_ms INTEGER, reason TEXT, refused_at_ms INTEGER, canceled_at_ms INTEGER, canceler_id TEXT, noted_at_ms INTEGER, CHECK ((canceled_at_ms IS NULL) = (canceler_id IS NULL)), CHECK (reason IS NULL OR ended_at_ms IS NOT NULL)) STRICT',
    );
    sql.exec("CREATE UNIQUE INDEX turns_running ON turns (status) WHERE status = 'running'");
    sql.exec(
      "CREATE INDEX turns_owing_notes ON turns (started_at_ms) WHERE noted_at_ms IS NULL AND (canceled_at_ms IS NOT NULL OR reason = 'faulted')",
    );
    sql.exec(
      'CREATE TABLE inbox_items (id TEXT PRIMARY KEY, text TEXT NOT NULL, delivery TEXT NOT NULL, sender_id TEXT NOT NULL, received_at_ms INTEGER NOT NULL, received_sequence INTEGER NOT NULL, written_at_ms INTEGER, turn_id TEXT REFERENCES turns (id)) STRICT',
    );
    sql.exec('CREATE INDEX inbox_items_by_turn ON inbox_items (turn_id, written_at_ms)');
    sql.exec('CREATE TABLE events (sequence INTEGER PRIMARY KEY, event TEXT NOT NULL) STRICT');
    sql.exec(
      'CREATE TABLE memory_changes (pi_task_id INTEGER PRIMARY KEY, turn_id TEXT NOT NULL REFERENCES turns (id), path TEXT NOT NULL, text TEXT, digest TEXT, version INTEGER UNIQUE, saved_at_ms INTEGER, CHECK ((text IS NULL) = (digest IS NULL)), CHECK ((version IS NULL) = (saved_at_ms IS NULL))) STRICT',
    );
    sql.exec('CREATE INDEX memory_changes_by_path ON memory_changes (path, version)');
    sql.exec(
      'CREATE TABLE threads (id TEXT PRIMARY KEY, pi_task_id INTEGER NOT NULL UNIQUE, title TEXT NOT NULL, state TEXT NOT NULL, note TEXT, opened_at_ms INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL) STRICT',
    );
    sql.exec(
      'CREATE TABLE drones (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES threads (id), pi_task_id INTEGER NOT NULL UNIQUE, brief TEXT NOT NULL, memory_version INTEGER NOT NULL, report_inbox_item_id TEXT NOT NULL UNIQUE, pi_session_id TEXT UNIQUE, status TEXT NOT NULL, reason TEXT, started_at_ms INTEGER NOT NULL, ended_at_ms INTEGER, refused_at_ms INTEGER, canceled_at_ms INTEGER, canceler_id TEXT, stopped_at_ms INTEGER, CHECK ((canceled_at_ms IS NULL) = (canceler_id IS NULL)), CHECK (reason IS NULL OR ended_at_ms IS NOT NULL), CHECK (stopped_at_ms IS NULL OR ended_at_ms IS NOT NULL)) STRICT',
    );
    sql.exec('CREATE INDEX drones_by_status ON drones (status, thread_id)');
    sql.exec(
      'CREATE INDEX drones_unstopped ON drones (status) WHERE stopped_at_ms IS NULL AND pi_session_id IS NOT NULL',
    );
    sql.exec(
      'CREATE TABLE forks (id TEXT PRIMARY KEY, name TEXT NOT NULL, requester_id TEXT NOT NULL, started_at_ms INTEGER NOT NULL, sequence INTEGER, ended_at_ms INTEGER, CHECK (ended_at_ms IS NULL OR sequence IS NOT NULL)) STRICT',
    );
    // `copy` holds one row, the start of the copy this mech receives from its parent, until that copy ends.
    sql.exec('CREATE TABLE copy (started_at_ms INTEGER NOT NULL) STRICT');
  },
  ({ sql }) => {
    sql.exec('ALTER TABLE mech ADD COLUMN revision INTEGER NOT NULL DEFAULT 1');
    sql.exec('ALTER TABLE mech ADD COLUMN active_revision INTEGER NOT NULL DEFAULT 1');
    sql.exec('ALTER TABLE mech ADD COLUMN indexed_revision INTEGER NOT NULL DEFAULT 0');
    sql.exec("ALTER TABLE mech ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
    sql.exec('ALTER TABLE mech ADD COLUMN updated_at_ms INTEGER NOT NULL DEFAULT 0');
    sql.exec("ALTER TABLE mech ADD COLUMN updater_id TEXT NOT NULL DEFAULT ''");
    sql.exec('UPDATE mech SET updated_at_ms = created_at_ms, updater_id = creator_id');
    sql.exec(
      'CREATE TABLE mech_revisions (revision INTEGER PRIMARY KEY, name TEXT NOT NULL, model TEXT NOT NULL, instructions TEXT, daily_cap_micros INTEGER NOT NULL, status TEXT NOT NULL, updated_at_ms INTEGER NOT NULL, updater_id TEXT NOT NULL) STRICT',
    );
    sql.exec(
      'INSERT INTO mech_revisions (revision, name, model, instructions, daily_cap_micros, status, updated_at_ms, updater_id) SELECT revision, name, model, instructions, daily_cap_micros, status, updated_at_ms, updater_id FROM mech',
    );
    sql.exec('ALTER TABLE turns ADD COLUMN definition_revision INTEGER NOT NULL DEFAULT 1');
  },
  ({ sql }) => {
    sql.exec(
      'CREATE TABLE watches (id TEXT PRIMARY KEY, name TEXT NOT NULL, prompt TEXT NOT NULL, interval_seconds INTEGER NOT NULL, status TEXT NOT NULL, notification_binding_id TEXT, cooldown_seconds INTEGER NOT NULL, max_check_seconds INTEGER NOT NULL, next_run_at_ms INTEGER NOT NULL, creator_id TEXT NOT NULL, created_at_ms INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL, last_check_outcome TEXT, last_checked_at_ms INTEGER) STRICT',
    );
    sql.exec('CREATE INDEX watches_due ON watches (status, next_run_at_ms)');
    sql.exec(
      'CREATE TABLE watch_checks (inbox_item_id TEXT PRIMARY KEY REFERENCES inbox_items (id), watch_id TEXT NOT NULL REFERENCES watches (id), scheduled_at_ms INTEGER NOT NULL, max_check_seconds INTEGER NOT NULL, settled_at_ms INTEGER) STRICT',
    );
    sql.exec('CREATE INDEX watch_checks_by_watch ON watch_checks (watch_id, settled_at_ms)');
    sql.exec(
      'CREATE TABLE findings (id TEXT PRIMARY KEY, watch_id TEXT NOT NULL REFERENCES watches (id), key TEXT NOT NULL, state TEXT NOT NULL, fingerprint TEXT NOT NULL, summary TEXT NOT NULL, evidence TEXT NOT NULL, window_start_ms INTEGER NOT NULL, window_end_ms INTEGER NOT NULL, change TEXT NOT NULL, revision INTEGER NOT NULL, first_observed_at_ms INTEGER NOT NULL, observed_at_ms INTEGER NOT NULL, changed_at_ms INTEGER NOT NULL, notified_at_ms INTEGER, notified_fingerprint TEXT, notified_state TEXT, UNIQUE (watch_id, key)) STRICT',
    );
    sql.exec('CREATE TABLE finding_reports (pi_task_id INTEGER PRIMARY KEY, receipt TEXT NOT NULL) STRICT');
  },
  ({ sql }) => {
    sql.exec(
      'CREATE TABLE slack_inbox_origins (inbox_item_id TEXT PRIMARY KEY REFERENCES inbox_items(id), origin TEXT NOT NULL) STRICT',
    );
    sql.exec(
      'CREATE TABLE slack_deliveries (id TEXT PRIMARY KEY, binding_id TEXT NOT NULL, destination TEXT, text TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, next_attempt_at INTEGER, attempted_at INTEGER, content_sha256 TEXT, message_timestamp TEXT, last_error TEXT, reconciliation_count INTEGER NOT NULL) STRICT',
    );
    sql.exec('CREATE INDEX slack_deliveries_due ON slack_deliveries (status, next_attempt_at)');
  },
  ({ sql }) => {
    sql.exec(
      'CREATE TABLE source_grant (slot INTEGER PRIMARY KEY CHECK (slot = 1), record TEXT NOT NULL, principal_id TEXT NOT NULL) STRICT',
    );
    sql.exec('CREATE TABLE source_tasks (id TEXT PRIMARY KEY, record TEXT NOT NULL) STRICT');
    sql.exec(
      'CREATE TABLE source_grant_changes (sequence INTEGER PRIMARY KEY, record TEXT, principal_id TEXT NOT NULL) STRICT',
    );
  },
];
