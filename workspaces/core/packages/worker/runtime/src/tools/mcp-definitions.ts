import { ConnectionId } from '@mechane/records';
import { Schema } from 'effect';
import { NativeFields } from '../actor/records.ts';
import { MCP_MAX_TOOLS } from './constants.ts';

export const McpDefinition = Schema.Struct({
  connectionId: ConnectionId,
  name: Schema.String,
  remoteName: Schema.String,
  description: Schema.String,
  inputSchema: NativeFields,
});

export type McpDefinition = typeof McpDefinition.Type;

export const McpDiscovery = Schema.Struct({
  tools: Schema.Array(McpDefinition).check(Schema.isMaxLength(MCP_MAX_TOOLS)),
  notices: Schema.Array(Schema.String),
  isComplete: Schema.Boolean,
});

export type McpDiscovery = typeof McpDiscovery.Type;
