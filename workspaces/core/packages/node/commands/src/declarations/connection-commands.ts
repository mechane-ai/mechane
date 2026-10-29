import {
  IntegrationSecretReference,
  NoFields,
  RemoteMcpUrl,
  RemoteToolNames,
  RemoteToolPolicy,
} from '@mechane/protocol';
import { ConnectionId, MechId, RecordName, renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';
import { MECH_ARGUMENT } from './constants.ts';

const CONNECTION_ARGUMENT = { name: 'connection-id', summary: 'the connection id' } as const;

const CONNECTION_FLAGS = {
  'name': { kind: FlagKind.Text, summary: 'the name for the remote MCP server' },
  'url': { kind: FlagKind.Text, summary: 'the Streamable HTTP MCP URL without credentials or a query' },
  'secret-reference': {
    kind: FlagKind.Text,
    summary: 'a server-only bearer credential reference scoped to this workspace; omit for no authentication',
  },
  'allowed-tools': { kind: FlagKind.Text, summary: 'a JSON array of the exact remote tools approved for grants' },
  'policy': {
    kind: FlagKind.Text,
    summary: 'read_only_free confirms every allowed tool is read-only and incurs no external charge',
  },
} as const;

const CONNECTION_FIELDS = {
  name: RecordName,
  url: RemoteMcpUrl,
  secretReference: Schema.OptionFromOptionalKey(IntegrationSecretReference),
  allowedTools: Schema.fromJsonString(RemoteToolNames),
  policy: Schema.Literal(RemoteToolPolicy.ReadOnlyFree),
} as const;

const CONNECTION_RENAMES = { secretReference: 'secret-reference', allowedTools: 'allowed-tools' } as const;

const ToolsJson = Schema.fromJsonString(RemoteToolNames);

/** The owner CLI requires an explicit free, read-only policy for each reusable connection. */
export const CONNECTION_COMMANDS = {
  'connection create': {
    summary: 'register a reusable remote MCP connection with explicitly approved read-only tools',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'createConnection'],
    flags: CONNECTION_FLAGS,
    arguments: [],
    input: renamedWireStruct({ fields: CONNECTION_FIELDS, renames: CONNECTION_RENAMES }),
  },
  'connection update': {
    summary: 'replace a connection configuration and restrict every future invocation to its current allowlist',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'updateConnection'],
    flags: CONNECTION_FLAGS,
    arguments: [CONNECTION_ARGUMENT],
    input: renamedWireStruct({
      fields: { ...CONNECTION_FIELDS, connectionId: ConnectionId },
      renames: { ...CONNECTION_RENAMES, connectionId: 'connection-id' },
    }),
  },
  'connection list': {
    summary: 'list the workspace remote connections as their owner',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listConnections'],
    flags: {},
    arguments: [],
    input: NoFields,
  },
  'connection delete': {
    summary: 'delete a connection and revoke every agent grant to it',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'deleteConnection'],
    flags: {},
    arguments: [CONNECTION_ARGUMENT],
    input: renamedWireStruct({ fields: { connectionId: ConnectionId }, renames: { connectionId: 'connection-id' } }),
  },
  'grant set': {
    summary: 'grant one mech an explicit subset of a connection allowlist, replacing its previous grant',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'grantTools'],
    flags: { tools: { kind: FlagKind.Text, summary: 'a JSON array of approved tool names' } },
    arguments: [MECH_ARGUMENT, CONNECTION_ARGUMENT],
    input: renamedWireStruct({
      fields: { mechId: MechId, connectionId: ConnectionId, tools: ToolsJson },
      renames: { mechId: 'mech-id', connectionId: 'connection-id' },
    }),
  },
  'grant list': {
    summary: "list one mech's explicit remote tool grants",
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listToolGrants'],
    flags: {},
    arguments: [MECH_ARGUMENT],
    input: renamedWireStruct({ fields: { mechId: MechId }, renames: { mechId: 'mech-id' } }),
  },
  'grant revoke': {
    summary: "revoke one mech's access to a connection before its next tool call",
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'revokeTools'],
    flags: {},
    arguments: [MECH_ARGUMENT, CONNECTION_ARGUMENT],
    input: renamedWireStruct({
      fields: { mechId: MechId, connectionId: ConnectionId },
      renames: { mechId: 'mech-id', connectionId: 'connection-id' },
    }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
