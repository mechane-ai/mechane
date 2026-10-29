import { decodeFirst } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime } from 'effect';
import type { Option } from 'effect';
import { LimitWindowRow } from '../schemas.ts';
import type { LimitWindowInput, LimitWindowRecords, WriteWindowInput } from '../types.ts';

/** A limiter's current window of each policy it counts. */
export function limitWindowRecords({ sql }: RecordsInput): LimitWindowRecords {
  return {
    limitWindow: (input) => limitWindow({ sql, ...input }),
    writeWindow: (input) => writeWindow({ sql, ...input }),
  };
}

function limitWindow({ sql, policy }: SqlCall<LimitWindowInput>): Option.Option<LimitWindowRow> {
  const cursor = sql.exec('SELECT opened_at_ms, taken FROM windows WHERE policy = ?', policy);

  return decodeFirst({ cursor, schema: LimitWindowRow });
}

function writeWindow({ sql, policy, openedAt, taken }: SqlCall<WriteWindowInput>): void {
  sql.exec(
    'INSERT INTO windows (policy, opened_at_ms, taken) VALUES (?, ?, ?) ON CONFLICT (policy) DO UPDATE SET opened_at_ms = excluded.opened_at_ms, taken = excluded.taken',
    policy,
    DateTime.toEpochMillis(openedAt),
    taken,
  );
}
