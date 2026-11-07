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
  ({ sql }) => {
    sql.exec(
      'CREATE TABLE managed_processes (id TEXT PRIMARY KEY, machine_id TEXT REFERENCES machines (id), run_id TEXT NOT NULL, record TEXT NOT NULL) STRICT',
    );
    sql.exec('CREATE INDEX managed_processes_by_run ON managed_processes (run_id)');
    sql.exec('CREATE TABLE interactive_run_cancellations (run_id TEXT PRIMARY KEY) STRICT');
    sql.exec(
      'CREATE TABLE machine_drains (machine_id TEXT PRIMARY KEY REFERENCES machines (id), operation_id TEXT NOT NULL UNIQUE) STRICT',
    );
    sql.exec(
      'CREATE TABLE browser_calls (id TEXT PRIMARY KEY, machine_id TEXT REFERENCES machines (id), run_id TEXT NOT NULL, record TEXT NOT NULL) STRICT',
    );
    sql.exec('CREATE INDEX browser_calls_by_run ON browser_calls (run_id)');
    sql.exec(
      'CREATE TABLE browser_machine (slot INTEGER PRIMARY KEY CHECK (slot = 1), machine_id TEXT NOT NULL REFERENCES machines (id)) STRICT',
    );
    sql.exec(
      'CREATE TABLE browser_tabs (tab_id TEXT PRIMARY KEY, machine_id TEXT NOT NULL REFERENCES machines (id)) STRICT',
    );
    sql.exec(
      'CREATE TABLE evidence_artifacts (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, run_id TEXT, execution_id TEXT NOT NULL UNIQUE, tool_call_id TEXT NOT NULL, size_bytes INTEGER NOT NULL, record TEXT NOT NULL, UNIQUE (run_id, tool_call_id)) STRICT',
    );
    sql.exec('CREATE INDEX evidence_by_run ON evidence_artifacts (run_id)');
    sql.exec(
      'CREATE TABLE evidence_chunks (artifact_id TEXT NOT NULL REFERENCES evidence_artifacts (id), offset_bytes INTEGER NOT NULL, size_bytes INTEGER NOT NULL, sha256 TEXT NOT NULL, PRIMARY KEY (artifact_id, offset_bytes)) STRICT',
    );
  },
];
