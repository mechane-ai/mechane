import { Finding } from '@mechane/protocol';
import { decodeFirst, decodeRows } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { Option, Schema } from 'effect';
import { FindingRow } from '../finding.schemas.ts';
import type { TaskIdInput } from '../task.types.ts';
import type { WatchIdInput } from '../watch.types.ts';

/** The serialized report result saved under the harness task ID for replay. */
const FindingReceiptRow = Schema.Struct({
  receipt: Schema.fromJsonString(Schema.Struct({ finding: Finding, isChanged: Schema.Boolean })),
});

type FindingReceiptRow = typeof FindingReceiptRow.Type;

/** The original finding result and change flag returned on a tool replay. */
type FindingReceipt = typeof FindingReceiptRow.Type.receipt;

type FindingIdentityInput = WatchIdInput & { readonly key: string };

type SaveFindingInput = { readonly finding: FindingRow };

type SaveFindingReportInput = TaskIdInput & { readonly receipt: FindingReceipt };

/** The record operations inferred from the finding store factory. */
export type FindingRecords = ReturnType<typeof findingRecords>;

/** Reads and writes current finding identities and immutable tool receipts. */
export function findingRecords({ sql }: RecordsInput) {
  return {
    finding: (input: FindingIdentityInput): Option.Option<FindingRow> => readFinding({ sql, ...input }),
    findings: (input: WatchIdInput): ReadonlyArray<FindingRow> => readFindings({ sql, ...input }),
    saveFinding: (input: SaveFindingInput): void => saveFinding({ sql, ...input }),
    findingReport: (input: TaskIdInput): Option.Option<FindingReceipt> => readFindingReport({ sql, ...input }),
    saveFindingReport: (input: SaveFindingReportInput): void => saveFindingReport({ sql, ...input }),
  };
}

function readFinding({ sql, watchId, key }: SqlCall<FindingIdentityInput>): Option.Option<FindingRow> {
  const cursor = sql.exec('SELECT * FROM findings WHERE watch_id = ? AND key = ?', watchId, key);

  return decodeFirst({ cursor, schema: FindingRow });
}

function readFindings({ sql, watchId }: SqlCall<WatchIdInput>): ReadonlyArray<FindingRow> {
  const cursor = sql.exec('SELECT * FROM findings WHERE watch_id = ? ORDER BY changed_at_ms DESC, id', watchId);

  return decodeRows({ cursor, schema: FindingRow });
}

function saveFinding({ sql, finding }: SqlCall<SaveFindingInput>): void {
  const row = Schema.encodeSync(FindingRow)(finding);

  sql.exec(
    'INSERT INTO findings (id, watch_id, key, state, fingerprint, summary, evidence, window_start_ms, window_end_ms, change, revision, first_observed_at_ms, observed_at_ms, changed_at_ms, notified_at_ms, notified_fingerprint, notified_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (watch_id, key) DO UPDATE SET state = excluded.state, fingerprint = excluded.fingerprint, summary = excluded.summary, evidence = excluded.evidence, window_start_ms = excluded.window_start_ms, window_end_ms = excluded.window_end_ms, change = excluded.change, revision = excluded.revision, observed_at_ms = excluded.observed_at_ms, changed_at_ms = excluded.changed_at_ms, notified_at_ms = excluded.notified_at_ms, notified_fingerprint = excluded.notified_fingerprint, notified_state = excluded.notified_state',
    row.id,
    row.watch_id,
    row.key,
    row.state,
    row.fingerprint,
    row.summary,
    row.evidence,
    row.window_start_ms,
    row.window_end_ms,
    row.change,
    row.revision,
    row.first_observed_at_ms,
    row.observed_at_ms,
    row.changed_at_ms,
    row.notified_at_ms,
    row.notified_fingerprint,
    row.notified_state,
  );
}

function readFindingReport({ sql, taskId }: SqlCall<TaskIdInput>): Option.Option<FindingReceipt> {
  const cursor = sql.exec('SELECT receipt FROM finding_reports WHERE pi_task_id = ?', taskId);
  const row = decodeFirst({ cursor, schema: FindingReceiptRow });

  return Option.map(row, ({ receipt }) => receipt);
}

function saveFindingReport({ sql, taskId, receipt }: SqlCall<SaveFindingReportInput>): void {
  const row = Schema.encodeSync(FindingReceiptRow)({ receipt });

  sql.exec('INSERT INTO finding_reports (pi_task_id, receipt) VALUES (?, ?)', taskId, row.receipt);
}
