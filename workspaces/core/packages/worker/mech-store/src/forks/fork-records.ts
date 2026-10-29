import { decodeFirst } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime } from 'effect';
import type { Option } from 'effect';
import type { BeginCopyInput, EndForkInput, ForkRecords, RecordCopyInput, RecordForkInput } from '../fork.types.ts';
import { CopyRow, ForkRow } from '../schemas.ts';

/** The record functions of the forks a mech made, each recorded once, and of the one copy a fork's object receives. */
export function forkRecords({ sql }: RecordsInput): ForkRecords {
  return {
    openFork: () => openFork({ sql }),
    recordFork: (input) => recordFork({ sql, ...input }),
    recordCopy: (input) => recordCopy({ sql, ...input }),
    endFork: (input) => endFork({ sql, ...input }),
    beginCopy: (input) => beginCopy({ sql, ...input }),
    copy: () => copy({ sql }),
    endCopy: () => endCopy({ sql }),
  };
}

function openFork({ sql }: RecordsInput): Option.Option<ForkRow> {
  const cursor = sql.exec(
    'SELECT id, name, requester_id, started_at_ms, sequence FROM forks WHERE ended_at_ms IS NULL',
  );

  return decodeFirst({ cursor, schema: ForkRow });
}

function recordFork({ sql, fork }: SqlCall<RecordForkInput>): void {
  sql.exec(
    'INSERT INTO forks (id, name, requester_id, started_at_ms) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING',
    fork.id,
    fork.name,
    fork.requesterId,
    DateTime.toEpochMillis(fork.startedAt),
  );
}

function recordCopy({ sql, forkId, sequence }: SqlCall<RecordCopyInput>): void {
  sql.exec('UPDATE forks SET sequence = ? WHERE id = ?', sequence, forkId);
}

function endFork({ sql, forkId, now }: SqlCall<EndForkInput>): void {
  sql.exec('UPDATE forks SET ended_at_ms = ? WHERE id = ?', DateTime.toEpochMillis(now), forkId);
}

function beginCopy({ sql, now }: SqlCall<BeginCopyInput>): void {
  sql.exec('INSERT INTO copy (started_at_ms) VALUES (?)', DateTime.toEpochMillis(now));
}

/** The `copy` table holds one row, the copy's begin, until the copy ends. */
function copy({ sql }: RecordsInput): Option.Option<CopyRow> {
  const cursor = sql.exec('SELECT started_at_ms FROM copy');

  return decodeFirst({ cursor, schema: CopyRow });
}

function endCopy({ sql }: RecordsInput): void {
  sql.exec('DELETE FROM copy');
}
