import { decodeFirst } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime } from 'effect';
import type { Option } from 'effect';
import { ExecutionStatus, MachineStatus } from '../constants.ts';
import { LiveMachineRow, MachineIdRow } from '../schemas.ts';
import type { FailMachineInput, MachineRecords, MachineTimeInput } from '../types.ts';
import { bindRemoteGuest } from './bind-remote-guest.ts';
import { bindRemoteSandbox } from './bind-remote-sandbox.ts';
import { remoteGuest } from './remote-guest.ts';
import { remoteSandbox } from './remote-sandbox.ts';

/** The sandbox's machines on its object's SQL storage. */
export function machineRecords({ sql }: RecordsInput): MachineRecords {
  return {
    remoteSandbox: () => remoteSandbox({ sql }),
    bindRemoteSandbox: (input) => bindRemoteSandbox({ sql, ...input }),
    remoteGuest: () => remoteGuest({ sql }),
    bindRemoteGuest: (input) => bindRemoteGuest({ sql, ...input }),
    liveMachine: () => liveMachine({ sql }),
    latestMachine: () => latestMachine({ sql }),
    openMachine: (input) => openMachine({ sql, ...input }),
    readyMachine: (input) => readyMachine({ sql, ...input }),
    loseMachine: (input) => loseMachine({ sql, ...input }),
    failMachine: (input) => failMachine({ sql, ...input }),
  };
}

/** A machine opens only when none is live, so at most one row is starting or ready. */
function liveMachine({ sql }: RecordsInput): Option.Option<LiveMachineRow> {
  const cursor = sql.exec(
    'SELECT id, status, started_at_ms FROM machines WHERE status IN (?, ?)',
    MachineStatus.Starting,
    MachineStatus.Ready,
  );

  return decodeFirst({ cursor, schema: LiveMachineRow });
}

/** Machines are opened one after another, so the highest row id is the last one opened. */
function latestMachine({ sql }: RecordsInput): Option.Option<MachineIdRow> {
  const cursor = sql.exec('SELECT id FROM machines ORDER BY rowid DESC LIMIT 1');

  return decodeFirst({ cursor, schema: MachineIdRow });
}

function openMachine({ sql, machineId, now }: SqlCall<MachineTimeInput>): void {
  sql.exec(
    'INSERT INTO machines (id, status, started_at_ms) VALUES (?, ?, ?)',
    machineId,
    MachineStatus.Starting,
    DateTime.toEpochMillis(now),
  );
}

function readyMachine({ sql, machineId, now }: SqlCall<MachineTimeInput>): void {
  sql.exec(
    'UPDATE machines SET status = ?, ready_at_ms = ? WHERE id = ? AND status = ?',
    MachineStatus.Ready,
    DateTime.toEpochMillis(now),
    machineId,
    MachineStatus.Starting,
  );
}

/** Ends a machine that ran: an execution it held without a receipt may have partly run, so it is uncertain. */
function loseMachine({ sql, machineId, now }: SqlCall<MachineTimeInput>): void {
  endMachine({ sql, machineId, now });
  sql.exec(
    'UPDATE executions SET status = ? WHERE machine_id = ? AND status = ?',
    ExecutionStatus.Uncertain,
    machineId,
    ExecutionStatus.Dispatched,
  );
}

/**
 * Ends a machine that never became ready. No execution reached it, so each one claimed by its startup deadline never
 * ran and is unavailable, while one claimed later stays pending for a new machine.
 */
function failMachine({ sql, machineId, startupDeadline, now }: SqlCall<FailMachineInput>): void {
  endMachine({ sql, machineId, now });
  sql.exec(
    'UPDATE executions SET status = ? WHERE status = ? AND claimed_at_ms <= ?',
    ExecutionStatus.Unavailable,
    ExecutionStatus.Pending,
    DateTime.toEpochMillis(startupDeadline),
  );
}

function endMachine({ sql, machineId, now }: SqlCall<MachineTimeInput>): void {
  sql.exec(
    'UPDATE machines SET status = ?, ended_at_ms = ? WHERE id = ? AND status <> ?',
    MachineStatus.Ended,
    DateTime.toEpochMillis(now),
    machineId,
    MachineStatus.Ended,
  );
}
