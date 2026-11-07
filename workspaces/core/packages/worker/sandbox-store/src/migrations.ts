import type { Migration } from '@mechane/store';

/** Commands and machines retain their intent before the corresponding external effect starts. */
export const MIGRATIONS: ReadonlyArray<Migration> = [
  ({ sql }) => {
    sql.exec(
      'CREATE TABLE machines (id TEXT PRIMARY KEY, status TEXT NOT NULL, started_at_ms INTEGER NOT NULL, ready_at_ms INTEGER, ended_at_ms INTEGER) STRICT',
    );
    sql.exec('CREATE INDEX machines_by_status ON machines (status)');
    sql.exec(
      'CREATE TABLE executions (id TEXT PRIMARY KEY, command TEXT NOT NULL, timeout_ms INTEGER NOT NULL, status TEXT NOT NULL, machine_id TEXT REFERENCES machines (id), claimed_at_ms INTEGER NOT NULL, dispatched_at_ms INTEGER, exit_code INTEGER, duration_ms INTEGER, output_text TEXT, omitted_bytes INTEGER, settled_at_ms INTEGER, persistence_failure TEXT, CHECK ((machine_id IS NULL) = (dispatched_at_ms IS NULL)), CHECK ((duration_ms IS NULL) = (settled_at_ms IS NULL) AND (duration_ms IS NULL) = (output_text IS NULL) AND (duration_ms IS NULL) = (omitted_bytes IS NULL)), CHECK (exit_code IS NULL OR duration_ms IS NOT NULL)) STRICT',
    );
    sql.exec('CREATE INDEX executions_by_status ON executions (status, machine_id)');
    sql.exec(
      'CREATE TABLE sandbox_workspace (slot INTEGER PRIMARY KEY CHECK (slot = 1), provider TEXT, head TEXT, checkpoint TEXT, file_checkpoint TEXT, restoration TEXT, recovery TEXT) STRICT',
    );
    sql.exec('INSERT INTO sandbox_workspace (slot) VALUES (1)');
    sql.exec('CREATE TABLE execution_cancellations (id TEXT PRIMARY KEY) STRICT');
    sql.exec('CREATE TABLE workspace_retirements (generation TEXT PRIMARY KEY) STRICT');
    sql.exec(
      'CREATE TABLE portable_maintenance (slot INTEGER PRIMARY KEY CHECK (slot = 1), value TEXT NOT NULL) STRICT',
    );
    sql.exec(
      'CREATE TABLE file_checkpoint_results (operation_id TEXT PRIMARY KEY, started_at_ms INTEGER NOT NULL, result TEXT NOT NULL) STRICT',
    );
    sql.exec(
      'CREATE TABLE sandbox_capacity (slot INTEGER PRIMARY KEY CHECK (slot = 1), owner TEXT NOT NULL, reservation TEXT, sequence INTEGER NOT NULL) STRICT',
    );
  },
];
