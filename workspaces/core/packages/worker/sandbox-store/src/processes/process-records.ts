import { Bytes, MachineId, ModelToolCallId } from '@mechane/records';
import {
  PROCESS_HISTORY_MAX_ENTRIES,
  PROCESS_MAX_INSTANCES,
  ProcessId,
  ProcessObservation,
  ProcessStart,
  ProcessState,
  SandboxRunId,
} from '@mechane/sandbox-wire';
import { decodeFirst, decodeRows } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { DateTime, Option, Result, Schema } from 'effect';
import { interactiveRuns } from '../interactive-runs.ts';
import { replayInteractiveClaim } from '../replay-interactive-claim.ts';

/** A durable start intent keeps a process bound to its first machine across retries and machine loss. */
export const ProcessRecord = Schema.Struct({
  processId: ProcessId,
  runId: SandboxRunId,
  toolCallId: ModelToolCallId,
  command: ProcessStart.to.fields.command,
  /** Absence means the process has not been assigned to a machine. */
  machineId: Schema.OptionFromNullOr(MachineId),
  /** Absence means the process has not been observed on its assigned machine. */
  observation: Schema.OptionFromNullOr(ProcessObservation),
  isStopRequested: Schema.Boolean,
});

export type ProcessRecord = typeof ProcessRecord.Type;
type ProcessIdentity = Pick<ProcessRecord, 'processId'>;
type ClaimProcessInput = Pick<ProcessRecord, 'processId' | 'runId' | 'toolCallId' | 'command'>;
type AssignProcessInput = ProcessIdentity & { readonly machineId: typeof MachineId.Type };
type ProcessObservationTime = { readonly now: DateTime.Utc };
type SaveProcessInput = { readonly observation: ProcessObservation };
type CancelProcessRunInput = { readonly runId: SandboxRunId };
type WriteProcessInput = { readonly record: ProcessRecord };
const ProcessJson = Schema.fromJsonString(ProcessRecord);
const StoredProcess = Schema.Struct({ record: ProcessJson });

class ProcessIdentityReused extends Schema.TaggedError<ProcessIdentityReused>()('ProcessIdentityReused', {
  processId: ProcessId,
}) {}

class ProcessRecordMissing extends Schema.TaggedError<ProcessRecordMissing>()('ProcessRecordMissing', {
  processId: ProcessId,
}) {}

/** Process intents retain their original machine and never store execution credentials. */
export function processRecords({ sql }: RecordsInput) {
  function process({ processId }: ProcessIdentity): Option.Option<ProcessRecord> {
    const cursor = sql.exec('SELECT record FROM managed_processes WHERE id = ?', processId);
    const stored = decodeFirst({ cursor, schema: StoredProcess });

    return Option.map(stored, ({ record }) => record);
  }

  function processes(): ReadonlyArray<ProcessRecord> {
    const cursor = sql.exec('SELECT record FROM managed_processes ORDER BY rowid');
    const rows = decodeRows({ cursor, schema: StoredProcess });

    return rows.map(({ record }) => record);
  }

  function runningProcesses(): ReadonlyArray<ProcessRecord> {
    const cursor = sql.exec(
      "SELECT record FROM managed_processes WHERE json_extract(record, '$.observation.state._tag') = 'Running' ORDER BY rowid DESC LIMIT ?",
      PROCESS_MAX_INSTANCES,
    );

    const rows = decodeRows({ cursor, schema: StoredProcess });

    return rows.map(({ record }) => record);
  }

  function noteProcessObservation({ now }: ProcessObservationTime): void {
    const timestamp = DateTime.toEpochMillis(now);

    sql.exec('UPDATE sandbox_activity SET processes_observed_at_ms = ? WHERE slot = 1', timestamp);
  }

  function processesObservedAt(): Option.Option<DateTime.Utc> {
    const cursor = sql.exec('SELECT processes_observed_at_ms FROM sandbox_activity WHERE slot = 1');
    const schema = Schema.Struct({ processes_observed_at_ms: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis) });
    const row = decodeFirst({ cursor, schema });

    return Option.flatMap(row, (value) => value.processes_observed_at_ms);
  }

  function recentTerminalProcesses(): ReadonlyArray<ProcessRecord> {
    const cursor = sql.exec(
      "SELECT record FROM managed_processes WHERE json_extract(record, '$.observation.state._tag') IN ('Exited', 'Stopped', 'Lost') ORDER BY rowid DESC LIMIT ?",
      PROCESS_HISTORY_MAX_ENTRIES,
    );

    const rows = decodeRows({ cursor, schema: StoredProcess });

    return rows.map(({ record }) => record);
  }

  function requiredProcess({ processId }: ProcessIdentity): ProcessRecord {
    const stored = process({ processId });

    if (Option.isNone(stored)) {
      const cause = new ProcessRecordMissing({ processId });
      const failed = Result.fail(cause);

      return Result.getOrThrow(failed);
    }

    return stored.value;
  }

  function writeProcess({ record }: WriteProcessInput): void {
    const value = Schema.encodeSync(ProcessJson)(record);
    const machineId = Option.getOrNull(record.machineId);

    sql.exec(
      'UPDATE managed_processes SET machine_id = ?, record = ? WHERE id = ?',
      machineId,
      value,
      record.processId,
    );
  }

  function claimProcess({ processId, runId, toolCallId, command }: ClaimProcessInput): ProcessRecord {
    const existing = process({ processId });

    if (Option.isSome(existing)) {
      const isSamePayload = existing.value.command === command;
      const mismatch = new ProcessIdentityReused({ processId });

      return replayInteractiveClaim({ existing: existing.value, runId, toolCallId, isSamePayload, mismatch });
    }

    const runs = interactiveRuns({ sql });
    const canceled = runs.canceledInteractiveRun({ runId });
    const isStopRequested = Option.isSome(canceled);

    const record: ProcessRecord = {
      processId,
      runId,
      toolCallId,
      command,
      machineId: Option.none(),
      observation: Option.none(),
      isStopRequested,
    };

    const value = Schema.encodeSync(ProcessJson)(record);

    sql.exec('INSERT INTO managed_processes (id, run_id, record) VALUES (?, ?, ?)', processId, runId, value);

    return record;
  }

  function assignProcess({ processId, machineId }: AssignProcessInput): ProcessRecord {
    const record = requiredProcess({ processId });

    if (Option.isSome(record.machineId)) {
      return record;
    }

    const assigned = { ...record, machineId: Option.some(machineId) };

    writeProcess({ record: assigned });

    return assigned;
  }

  function saveProcessObservation({ observation }: SaveProcessInput): void {
    const record = requiredProcess({ processId: observation.handle.processId });

    if (Option.isNone(record.machineId) || record.machineId.value !== observation.handle.machineId) {
      return;
    }

    if (Option.isSome(record.observation) && !ProcessState.guards.Running(record.observation.value.state)) {
      return;
    }

    const observed = { ...record, observation: Option.some(observation) };

    writeProcess({ record: observed });
  }

  function requestProcessStop({ processId }: ProcessIdentity): void {
    const record = process({ processId });

    if (Option.isSome(record)) {
      writeProcess({ record: { ...record.value, isStopRequested: true } });
    }
  }

  function cancelProcessRun({ runId }: CancelProcessRunInput): void {
    const cursor = sql.exec('SELECT record FROM managed_processes WHERE run_id = ?', runId);
    const rows = decodeRows({ cursor, schema: StoredProcess });

    for (const { record } of rows) {
      requestProcessStop({ processId: record.processId });
    }
  }

  function loseMachineProcesses({ machineId }: Pick<AssignProcessInput, 'machineId'>): void {
    for (const record of processes()) {
      const previous = record.observation;
      const isSameMachine = Option.contains(record.machineId, machineId);
      const isUnsettled = Option.isNone(previous) || ProcessState.guards.Running(previous.value.state);

      if (isSameMachine && isUnsettled) {
        const output = Option.match(previous, {
          onNone: () => ({ text: '', omittedBytes: Bytes.make(0) }),
          onSome: (observed) => observed.output,
        });

        const state = ProcessState.cases.Lost.make({});

        const observation = ProcessObservation.make({
          handle: { processId: record.processId, machineId },
          state,
          output,
        });

        saveProcessObservation({ observation });
      }
    }
  }

  return {
    process,
    processes,
    recentTerminalProcesses,
    runningProcesses,
    noteProcessObservation,
    processesObservedAt,
    requiredProcess,
    claimProcess,
    assignProcess,
    saveProcessObservation,
    requestProcessStop,
    cancelProcessRun,
    loseMachineProcesses,
  };
}
