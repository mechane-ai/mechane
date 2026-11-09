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
  ({ sql }) => {
    sql.exec(
      'CREATE TABLE sandbox_completions (execution_id TEXT NOT NULL, kind TEXT NOT NULL, receipt TEXT NOT NULL, is_delivered INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0, next_attempt_at_ms INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (execution_id, kind)) STRICT',
    );
    sql.exec('CREATE INDEX sandbox_completions_pending ON sandbox_completions (is_delivered)');
    sql.exec('CREATE TABLE sandbox_activity (slot INTEGER PRIMARY KEY CHECK (slot = 1), idle_at_ms INTEGER) STRICT');
    sql.exec('INSERT INTO sandbox_activity (slot) VALUES (1)');
    sql.exec(
      "CREATE TRIGGER execution_completion AFTER UPDATE OF status ON executions WHEN OLD.status IN ('pending', 'dispatched') AND NEW.status NOT IN ('pending', 'dispatched') BEGIN INSERT INTO sandbox_completions (execution_id, kind, receipt) VALUES (NEW.id, 'sandbox', json_object('executionId', NEW.id, 'kind', 'sandbox', 'machineId', NEW.machine_id, 'status', NEW.status, 'exitCode', NEW.exit_code)) ON CONFLICT DO NOTHING; END",
    );
    sql.exec(
      "CREATE TRIGGER process_completion AFTER UPDATE OF record ON managed_processes WHEN (json_extract(OLD.record, '$.observation.state._tag') IS NULL OR json_extract(OLD.record, '$.observation.state._tag') = 'Running') AND json_extract(NEW.record, '$.observation.state._tag') IN ('Exited', 'Stopped', 'Lost') BEGIN INSERT INTO sandbox_completions (execution_id, kind, receipt) VALUES (NEW.id, 'process', json_object('executionId', NEW.id, 'kind', 'process', 'machineId', NEW.machine_id, 'status', lower(json_extract(NEW.record, '$.observation.state._tag')), 'exitCode', json_extract(NEW.record, '$.observation.state.exitCode'))) ON CONFLICT DO NOTHING; END",
    );
  },
];
