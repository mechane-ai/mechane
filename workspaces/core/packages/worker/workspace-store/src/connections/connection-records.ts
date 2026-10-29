import { RemoteToolNames } from '@mechane/protocol';
import type { ToolGrant } from '@mechane/protocol';
import { ConnectionId, MechId, renamedWireStruct } from '@mechane/records';
import { decodeFirst, decodeRows } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { Schema } from 'effect';
import type { Option } from 'effect';
import { saveConnection } from './save-connection.ts';
import { ConnectionRow } from './schemas.ts';
import type { SaveConnectionInput } from './types.ts';

type ConnectionIdInput = { readonly connectionId: ConnectionId };

type MechGrantsInput = { readonly mechId: MechId };

const MechIdentity = Schema.Struct({ id: MechId });

const ToolGrantRow = renamedWireStruct({
  fields: { mechId: MechId, connectionId: ConnectionId, tools: Schema.fromJsonString(RemoteToolNames) },
  renames: {},
});

type MechConnectionInput = ConnectionIdInput & { readonly mechId: MechId };

/** The factory is the sole declaration of the connection persistence interface. */
export type ConnectionRecords = ReturnType<typeof connectionRecords>;

/** Connection deletion removes associated grants within the caller's storage transaction. */
export function connectionRecords({ sql }: RecordsInput) {
  return {
    readConnection: (input: ConnectionIdInput): Option.Option<ConnectionRow> => readConnection({ sql, ...input }),
    listConnections: (): ReadonlyArray<ConnectionRow> => listConnections({ sql }),
    saveConnection: (input: SaveConnectionInput): void => saveConnection({ sql, ...input }),
    deleteConnection: (input: ConnectionIdInput): void => deleteConnection({ sql, ...input }),
    connectionMech: (input: MechGrantsInput): Option.Option<typeof MechIdentity.Type> =>
      connectionMech({ sql, ...input }),
    listToolGrants: (input: MechGrantsInput): ReadonlyArray<ToolGrant> => listToolGrants({ sql, ...input }),
    listConnectionGrants: (input: ConnectionIdInput): ReadonlyArray<ToolGrant> =>
      listConnectionGrants({ sql, ...input }),
    grantTools: (input: ToolGrant): void => grantTools({ sql, ...input }),
    revokeTools: (input: MechConnectionInput): void => revokeTools({ sql, ...input }),
  };
}

function readConnection({ sql, connectionId }: SqlCall<ConnectionIdInput>): Option.Option<ConnectionRow> {
  const cursor = sql.exec('SELECT * FROM remote_connections WHERE id = ?', connectionId);

  return decodeFirst({ cursor, schema: ConnectionRow });
}

function listConnections({ sql }: RecordsInput): ReadonlyArray<ConnectionRow> {
  const cursor = sql.exec('SELECT * FROM remote_connections ORDER BY created_at_ms, id');

  return decodeRows({ cursor, schema: ConnectionRow });
}

function deleteConnection({ sql, connectionId }: SqlCall<ConnectionIdInput>): void {
  sql.exec('DELETE FROM mech_tool_grants WHERE connection_id = ?', connectionId);
  sql.exec('DELETE FROM remote_connections WHERE id = ?', connectionId);
}

function connectionMech({ sql, mechId }: SqlCall<MechGrantsInput>): Option.Option<typeof MechIdentity.Type> {
  const cursor = sql.exec('SELECT id FROM mechs WHERE id = ?', mechId);

  return decodeFirst({ cursor, schema: MechIdentity });
}

function listToolGrants({ sql, mechId }: SqlCall<MechGrantsInput>): ReadonlyArray<ToolGrant> {
  const cursor = sql.exec('SELECT * FROM mech_tool_grants WHERE mech_id = ? ORDER BY connection_id', mechId);

  return decodeRows({ cursor, schema: ToolGrantRow });
}

function listConnectionGrants({ sql, connectionId }: SqlCall<ConnectionIdInput>): ReadonlyArray<ToolGrant> {
  const cursor = sql.exec('SELECT * FROM mech_tool_grants WHERE connection_id = ?', connectionId);

  return decodeRows({ cursor, schema: ToolGrantRow });
}

function grantTools({ sql, mechId, connectionId, tools }: SqlCall<ToolGrant>): void {
  const row = Schema.encodeSync(ToolGrantRow)({ mechId, connectionId, tools });

  sql.exec(
    'INSERT INTO mech_tool_grants (mech_id, connection_id, tools) VALUES (?, ?, ?) ON CONFLICT (mech_id, connection_id) DO UPDATE SET tools = excluded.tools',
    row.mech_id,
    row.connection_id,
    row.tools,
  );
}

function revokeTools({ sql, mechId, connectionId }: SqlCall<MechConnectionInput>): void {
  sql.exec('DELETE FROM mech_tool_grants WHERE mech_id = ? AND connection_id = ?', mechId, connectionId);
}
