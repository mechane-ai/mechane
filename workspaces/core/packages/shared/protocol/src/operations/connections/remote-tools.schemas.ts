import { ConnectionId, RecordName, RecordText } from '@mechane/records';
import { Schema } from 'effect';
import { RemoteToolName, RemoteToolNames } from './schemas.ts';

/** Remote metadata is untrusted source content, including the tool description and argument schema. */
export const RemoteToolDescription = Schema.Struct({
  name: RemoteToolName,
  description: RecordText,
  inputSchema: Schema.Record(Schema.String, Schema.Unknown),
});

export type RemoteToolDescription = typeof RemoteToolDescription.Type;

/** Model-visible discovery exposes granted names without remote URL or credential references. */
const RemoteConnectionTools = Schema.Struct({ connectionId: ConnectionId, name: RecordName, tools: RemoteToolNames });

const COMPLETION_FIELDS = {
  /** Omission means transport cleanup completed without a reported failure. */
  cleanupFailed: Schema.optionalKey(Schema.Boolean),
} as const;

/** Remote calls return bounded, sanitized outcomes and preserve any transport cleanup failure. */
export const RemoteToolsOutcome = Schema.TaggedUnion({
  Connections: { ...COMPLETION_FIELDS, connections: Schema.Array(RemoteConnectionTools) },
  Tools: { ...COMPLETION_FIELDS, tools: Schema.Array(RemoteToolDescription) },
  Returned: { ...COMPLETION_FIELDS, content: RecordText, isError: Schema.Boolean },
  Refused: { ...COMPLETION_FIELDS, reason: RecordText },
  Failed: { ...COMPLETION_FIELDS, reason: RecordText },
});

export type RemoteToolsOutcome = typeof RemoteToolsOutcome.Type;
