import { IntegrationSecretReference, RemoteMcpUrl, RemoteToolNames, RemoteToolPolicy } from '@mechane/protocol';
import { ConnectionId, RecordName, renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** Stored timestamps use milliseconds and the secret column holds only a reference. */
export const ConnectionRow = renamedWireStruct({
  fields: {
    id: ConnectionId,
    name: RecordName,
    url: RemoteMcpUrl,
    /** None means the remote URL accepts unauthenticated requests; the wire carries null. */
    secretReference: Schema.OptionFromNullOr(IntegrationSecretReference),
    allowedTools: Schema.fromJsonString(RemoteToolNames),
    policy: Schema.Literal(RemoteToolPolicy.ReadOnlyFree),
    createdAt: Schema.DateTimeUtcFromMillis,
    updatedAt: Schema.DateTimeUtcFromMillis,
  },
  renames: { createdAt: 'created_at_ms', updatedAt: 'updated_at_ms' },
});

export type ConnectionRow = typeof ConnectionRow.Type;
