import { ExecutionAccessRecord } from '@mechane/protocol';
import type { ExecutionAccess } from '@mechane/protocol';
import type { MechId } from '@mechane/records';
import { decodeFirst } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { Option, Schema } from 'effect';

type ReadAccessInput = { readonly mechId: MechId };

type SaveAccessInput = ReadAccessInput & {
  /** None deletes the current grant. */
  readonly access: Option.Option<ExecutionAccess>;
};

const AccessJson = Schema.fromJsonString(ExecutionAccessRecord);
const AccessRow = Schema.Struct({ configuration: AccessJson });

/** Stores references and public configuration only; executable credentials never enter the workspace database. */
export function executionAccessRecords({ sql }: RecordsInput) {
  return {
    executionAccess: ({ mechId }: ReadAccessInput): Option.Option<ExecutionAccess> => {
      const cursor = sql.exec('SELECT configuration FROM mech_execution_access WHERE mech_id = ?', mechId);

      const row = decodeFirst({ cursor, schema: AccessRow });

      return Option.map(row, (held) => held.configuration);
    },
    saveExecutionAccess: ({ mechId, access }: SaveAccessInput): void => {
      if (Option.isNone(access)) {
        sql.exec('DELETE FROM mech_execution_access WHERE mech_id = ?', mechId);

        return;
      }

      const configuration = Schema.encodeSync(AccessJson)(access.value);

      sql.exec(
        'INSERT INTO mech_execution_access (mech_id, configuration) VALUES (?, ?) ON CONFLICT (mech_id) DO UPDATE SET configuration = excluded.configuration',
        mechId,
        configuration,
      );
    },
  };
}
