import type { SourceId } from '@mechane/records';
import { decodeFirst } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option, Schema } from 'effect';
import { SourceTask } from './schemas.ts';
import { sourceGrantRecords } from './source-grant-records.ts';

const SourceTaskJson = Schema.fromJsonString(SourceTask);
const SourceTaskRow = Schema.Struct({ record: SourceTaskJson });
const readRecord: (row: typeof SourceTaskRow.Type) => SourceTask = (row) => row.record;
type SourceTaskIdentity = { readonly sourceId: SourceId };
type SaveSourceTaskInput = { readonly source: SourceTask };

/** Stores each pinned checkout and its publication journal independently. */
export function sourceRecords({ sql }: RecordsInput) {
  const sourceTask: (input: SourceTaskIdentity) => Option.Option<SourceTask> = ({ sourceId }) => {
    const cursor = sql.exec('SELECT record FROM source_tasks WHERE id = ?', sourceId);
    const decoded = decodeFirst({ cursor, schema: SourceTaskRow });

    return Option.map(decoded, readRecord);
  };

  const saveSourceTask: (input: SaveSourceTaskInput) => void = ({ source }) => {
    const record = Schema.encodeSync(SourceTaskJson)(source);

    sql.exec(
      'INSERT INTO source_tasks (id, record) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET record = excluded.record',
      source.sourceId,
      record,
    );
  };

  return { ...sourceGrantRecords({ sql }), sourceTask, saveSourceTask };
}
