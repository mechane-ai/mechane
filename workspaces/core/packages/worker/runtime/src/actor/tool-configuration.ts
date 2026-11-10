import type { Tx } from '@earendil-works/pi-durable';
import { McpDiscovery } from '../tools/mcp-definitions.ts';
import type { McpDiscovery as Configuration } from '../tools/mcp-definitions.ts';
import { actorRecordCollection } from './record-store.ts';
import type { ActorRecordReader } from './record-store.ts';

const configurations = actorRecordCollection('tool-configuration', McpDiscovery);
const CURRENT_CONFIGURATION = 'current';

export async function readToolConfiguration(reader: ActorRecordReader): Promise<Configuration | undefined> {
  return await configurations.get(reader, CURRENT_CONFIGURATION);
}

export async function writeToolConfiguration(input: {
  readonly transaction: Tx;
  readonly configuration: Configuration;
}): Promise<void> {
  await configurations.put(input.transaction, CURRENT_CONFIGURATION, input.configuration);
}
