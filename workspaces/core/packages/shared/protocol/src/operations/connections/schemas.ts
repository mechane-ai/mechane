import { SecureOrigin } from '@mechane/deployment';
import { ConnectionId, MechId, RecordName, RecordText, wireStruct, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { WireTime } from '../../schemas.ts';
import {
  REMOTE_URL_MAX_CHARS,
  RemoteToolPolicy,
  SECRET_REFERENCE_MAX_CHARS,
  TOOL_NAME_MAX_CHARS,
  TOOLS_PER_CONNECTION,
} from './constants.ts';

/** A requested tool name must fit the bound before exact matching against the owner grant. */
export const RemoteToolName = Schema.NonEmptyString.check(Schema.isMaxLength(TOOL_NAME_MAX_CHARS));

/** A request selects distinct names within the per-connection tool cap. */
export const RemoteToolNames = Schema.Array(RemoteToolName).check(
  Schema.isMaxLength(TOOLS_PER_CONNECTION),
  Schema.makeFilter((names) => new Set(names).size === names.length, { expected: 'distinct tool names' }),
);

/** Remote URLs allow secure HTTP or local loopback, without embedded credentials, queries, or fragments. */
export const RemoteMcpUrl = SecureOrigin.check(
  Schema.makeFilter((url) => url.href.length <= REMOTE_URL_MAX_CHARS, { expected: 'a bounded MCP remote URL' }),
  Schema.makeFilter((url) => url.username === '' && url.password === '', {
    expected: 'an remote URL without credentials',
  }),
  Schema.makeFilter((url) => url.search === '' && url.hash === '', {
    expected: 'an remote URL without a query or fragment',
  }),
);

/** A reference selects an operator-configured secret within the current workspace. */
export const IntegrationSecretReference = Schema.NonEmptyString.check(
  Schema.isMaxLength(SECRET_REFERENCE_MAX_CHARS),
  Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/u),
);

const CONNECTION_FIELDS = {
  name: RecordName,
  url: RemoteMcpUrl,
  /** None means the remote URL accepts unauthenticated requests; the wire carries null. */
  secretReference: Schema.OptionFromNullOr(IntegrationSecretReference),
  allowedTools: RemoteToolNames,
  policy: Schema.Literal(RemoteToolPolicy.ReadOnlyFree),
} as const;

/** Owners replace the whole configuration; omission cannot preserve an old credential reference. */
export const ConnectionConfiguration = wireStruct({ fields: CONNECTION_FIELDS });

export type ConnectionConfiguration = typeof ConnectionConfiguration.Type;

/** Persisted configuration exposes references only and accepts historical values beyond current request limits. */
export const RemoteConnection = wireStruct({
  fields: {
    id: ConnectionId,
    name: RecordName,
    url: SecureOrigin,
    /** None means the remote URL accepts unauthenticated requests; the wire carries null. */
    secretReference: Schema.OptionFromNullOr(RecordText),
    allowedTools: Schema.Array(RecordText),
    policy: Schema.Literal(RemoteToolPolicy.ReadOnlyFree),
    createdAt: WireTime,
    updatedAt: WireTime,
  },
});

export type RemoteConnection = typeof RemoteConnection.Type;

/** Owner discovery returns configuration without contacting any remote remote URL. */
export const ConnectionList = Schema.Struct({ connections: Schema.Array(RemoteConnection) });

/** Both identifiers participate in workspace-scoped connection admission. */
export const ConnectionPath = wireStruct({ fields: { workspaceId: WorkspaceId, connectionId: ConnectionId } });

/** Deletion acknowledges the connection whose grants were removed. */
export const ConnectionDeletion = wireStruct({ fields: { connectionId: ConnectionId } });

/** The stored selection is replaced atomically and never expands when the connection adds tools. */
export const ToolGrant = wireStruct({
  fields: { mechId: MechId, connectionId: ConnectionId, tools: Schema.Array(RecordText) },
});

export type ToolGrant = typeof ToolGrant.Type;

/** A mech's current selections include grants with no remaining permitted tools. */
export const ToolGrantList = Schema.Struct({ grants: Schema.Array(ToolGrant) });

/** A grant is scoped to one mech and connection within the admitted workspace. */
export const ToolGrantPath = wireStruct({
  fields: { workspaceId: WorkspaceId, mechId: MechId, connectionId: ConnectionId },
});

export type RemoteToolName = typeof RemoteToolName.Type;

export type RemoteToolNames = typeof RemoteToolNames.Type;

export type RemoteMcpUrl = typeof RemoteMcpUrl.Type;

export type IntegrationSecretReference = typeof IntegrationSecretReference.Type;

export type ConnectionList = typeof ConnectionList.Type;

export type ConnectionPath = typeof ConnectionPath.Type;

export type ConnectionDeletion = typeof ConnectionDeletion.Type;

export type ToolGrantList = typeof ToolGrantList.Type;

export type ToolGrantPath = typeof ToolGrantPath.Type;
