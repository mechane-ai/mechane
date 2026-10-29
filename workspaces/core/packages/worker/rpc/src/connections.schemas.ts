import { RemoteConnection, ToolGrant } from '@mechane/protocol';
import { Schema } from 'effect';

/** Workspace mutation distinguishes missing configuration from an exhausted connection cap. */
export const ConnectionMutation = Schema.TaggedUnion({
  Saved: { connection: RemoteConnection },
  NotFound: {},
  LimitReached: {},
});

export type ConnectionMutation = typeof ConnectionMutation.Type;

/** A grant mutation reports the exact authority check that refused it. */
export const ToolGrantMutation = Schema.TaggedUnion({
  Granted: { grant: ToolGrant },
  ConnectionNotFound: {},
  MechNotFound: {},
  InvalidTools: {},
});

export type ToolGrantMutation = typeof ToolGrantMutation.Type;

/** The trusted caller receives current configuration and its intersected mech selection together. */
export const GrantedConnection = Schema.Struct({ connection: RemoteConnection, grant: ToolGrant });

export type GrantedConnection = typeof GrantedConnection.Type;

/** Discovery carries no cached grant authority across invocations. */
export const GrantedConnections = Schema.Array(GrantedConnection);

/** Null means the current mech has no grant for the requested connection. */
export const GrantedConnectionReading = Schema.OptionFromNullOr(GrantedConnection);

export type GrantedConnections = typeof GrantedConnections.Type;
export type GrantedConnectionReading = typeof GrantedConnectionReading.Type;
