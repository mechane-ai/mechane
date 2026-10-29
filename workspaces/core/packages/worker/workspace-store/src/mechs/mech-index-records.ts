import { RecordText } from '@mechane/records';
import { decodeOne, readPage } from '@mechane/store';
import type { PageAfterInput, RecordsInput, SqlCall } from '@mechane/store';
import { Option, Schema } from 'effect';
import { MechRowPage, MechSummaryRow } from '../schemas.ts';
import type { CreationIntent, IndexMechInput, MechIndexRecords, PrepareMechCreationInput } from '../types.ts';

const CreationIntentRow = Schema.Struct({ fingerprint: RecordText, seed: RecordText });

/** The workspace's versioned roster and the creation intents that reserve stable mech identities. */
export function mechIndexRecords({ sql }: RecordsInput): MechIndexRecords {
  return {
    indexMech: (input) => indexMech({ sql, ...input }),
    mechs: (input) => mechs({ sql, ...input }),
    prepareMechCreation: (input) => prepareMechCreation({ sql, ...input }),
  };
}

/** Applies only newer definitions, so a delayed projection or retry cannot roll back the roster. */
function indexMech({ sql, mech }: SqlCall<IndexMechInput>): void {
  const row = Schema.encodeSync(MechSummaryRow)(mech);

  sql.exec(
    'INSERT INTO mechs (id, name, model, creator_id, created_at_ms, forked_from, revision, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name, model = excluded.model, revision = excluded.revision, status = excluded.status WHERE excluded.revision > mechs.revision',
    row.id,
    row.name,
    row.model,
    row.creator_id,
    row.created_at_ms,
    row.forked_from,
    row.revision,
    row.status,
  );
}

function mechs({ sql, after }: SqlCall<PageAfterInput>): MechRowPage {
  const page = readPage({
    after,
    lastRow: ({ last }) => sql.exec('SELECT rowid FROM mechs WHERE id = ?', last),
    rowsAfter: ({ rowid, count }) =>
      sql.exec(
        'SELECT id, name, model, creator_id, created_at_ms, forked_from, revision, status FROM mechs WHERE rowid > ? ORDER BY rowid LIMIT ?',
        rowid,
        count,
      ),
    schema: MechSummaryRow,
  });

  return Option.match(page, {
    onNone: () => MechRowPage.cases.CursorMissing.make({}),
    onSome: ({ rows, hasMore }) => MechRowPage.cases.Listed.make({ mechs: rows, hasMore }),
  });
}

function prepareMechCreation({ sql, requestId, fingerprint, seed }: SqlCall<PrepareMechCreationInput>): CreationIntent {
  sql.exec(
    'INSERT INTO mech_creation_intents (request_id, fingerprint, seed) VALUES (?, ?, ?) ON CONFLICT (request_id) DO NOTHING',
    requestId,
    fingerprint,
    seed,
  );

  const cursor = sql.exec('SELECT fingerprint, seed FROM mech_creation_intents WHERE request_id = ?', requestId);

  return decodeOne({ cursor, schema: CreationIntentRow });
}
