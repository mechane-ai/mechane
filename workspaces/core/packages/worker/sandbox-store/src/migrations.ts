import type { Migration } from '@mechane/store';

/**
 * A sandbox's schema steps in order, after the ledger that records them; append a step, and never edit one that has
 * shipped. A machine's row is written before its start, and an execution's before it is sent anywhere, so every effect
 * has its intent recorded first. Executions are kept for the sandbox's life: a rerun reads its receipt.
 */
export const MIGRATIONS: ReadonlyArray<Migration> = [
  ({ sql }) => {
    sql.exec(
      'CREATE TABLE machines (id TEXT PRIMARY KEY, status TEXT NOT NULL, started_at_ms INTEGER NOT NULL, ready_at_ms INTEGER, ended_at_ms INTEGER) STRICT',
    );
    sql.exec('CREATE INDEX machines_by_status ON machines (status)');
    sql.exec(
      'CREATE TABLE executions (id TEXT PRIMARY KEY, command TEXT NOT NULL, timeout_ms INTEGER NOT NULL, status TEXT NOT NULL, machine_id TEXT REFERENCES machines (id), claimed_at_ms INTEGER NOT NULL, dispatched_at_ms INTEGER, exit_code INTEGER, duration_ms INTEGER, output_text TEXT, omitted_bytes INTEGER, settled_at_ms INTEGER, CHECK ((machine_id IS NULL) = (dispatched_at_ms IS NULL)), CHECK ((duration_ms IS NULL) = (settled_at_ms IS NULL) AND (duration_ms IS NULL) = (output_text IS NULL) AND (duration_ms IS NULL) = (omitted_bytes IS NULL)), CHECK (exit_code IS NULL OR duration_ms IS NOT NULL)) STRICT',
    );
    sql.exec('CREATE INDEX executions_by_status ON executions (status, machine_id)');
  },
  ({ sql }) => {
    sql.exec(
      'CREATE TABLE remote_sandbox (slot INTEGER PRIMARY KEY CHECK (slot = 1), id TEXT NOT NULL, guest_machine_id TEXT) STRICT',
    );
  },
  ({ sql }) => {
    sql.exec(
      'CREATE TABLE sandbox_maintenance (slot INTEGER PRIMARY KEY CHECK (slot = 1), value TEXT NOT NULL) STRICT',
    );
  },
  ({ sql }) => {
    sql.exec(
      'CREATE TABLE sandbox_workspace (slot INTEGER PRIMARY KEY CHECK (slot = 1), provider TEXT, head TEXT, checkpoint TEXT, restoration TEXT, retired TEXT) STRICT',
    );
    sql.exec('INSERT INTO sandbox_workspace (slot) VALUES (1)');
  },
  ({ sql }) => {
    sql.exec('CREATE TABLE execution_cancellations (id TEXT PRIMARY KEY) STRICT');
  },
  ({ sql }) => {
    sql.exec('CREATE TABLE source_fences (id TEXT PRIMARY KEY, active INTEGER NOT NULL, record TEXT NOT NULL) STRICT');
    sql.exec('CREATE UNIQUE INDEX source_fences_active ON source_fences (active) WHERE active = 1');
  },
  ({ sql }) => {
    sql.exec('ALTER TABLE sandbox_workspace ADD COLUMN recovery TEXT');
    sql.exec('ALTER TABLE executions ADD COLUMN persistence_failure TEXT');
  },
  ({ sql }) => {
    sql.exec('CREATE TABLE workspace_retirements (generation TEXT PRIMARY KEY) STRICT');
    sql.exec(
      'INSERT INTO workspace_retirements (generation) SELECT retired FROM sandbox_workspace WHERE retired IS NOT NULL',
    );
  },
];
