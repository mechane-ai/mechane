import { SourceGrant } from '@mechane/protocol';
import type { PrincipalId } from '@mechane/records';
import { decodeFirst } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option, Schema } from 'effect';

const SourceGrantJson = Schema.fromJsonString(SourceGrant);
const SourceGrantRow = Schema.Struct({ record: SourceGrantJson });
const readRecord: (row: typeof SourceGrantRow.Type) => SourceGrant = (row) => row.record;

type SaveSourceGrantInput = {
  /** Absent approval records a revocation. */
  readonly grant: Option.Option<SourceGrant>;
  readonly principalId: PrincipalId;
};

/** Records every owner grant and revocation alongside its acting principal. */
export function sourceGrantRecords({ sql }: RecordsInput) {
  /** Absence means this mech has no current repository authority. */
  const sourceGrant: () => Option.Option<SourceGrant> = () => {
    const cursor = sql.exec('SELECT record FROM source_grant WHERE slot = 1');
    const decoded = decodeFirst({ cursor, schema: SourceGrantRow });

    return Option.map(decoded, readRecord);
  };

  const saveSourceGrant: (input: SaveSourceGrantInput) => void = ({ grant, principalId }) => {
    if (Option.isNone(grant)) {
      sql.exec('INSERT INTO source_grant_changes (record, principal_id) VALUES (NULL, ?)', principalId);
      sql.exec('DELETE FROM source_grant WHERE slot = 1');

      return;
    }

    const record = Schema.encodeSync(SourceGrantJson)(grant.value);

    sql.exec('INSERT INTO source_grant_changes (record, principal_id) VALUES (?, ?)', record, principalId);
    sql.exec(
      'INSERT INTO source_grant (slot, record, principal_id) VALUES (1, ?, ?) ON CONFLICT (slot) DO UPDATE SET record = excluded.record, principal_id = excluded.principal_id',
      record,
      principalId,
    );
  };

  return { sourceGrant, saveSourceGrant };
}
