import { isManagedDocument, ManagedStoreError } from '@mechane/authority-store';
import type { ManagedDocument } from '@mechane/authority-store';
import { HttpStatusCode } from '@mechane/records';
import { Record } from 'effect';
import { agentDefinition, validateEffectiveToolsets } from './agent-definition.ts';

const SNAPSHOT_FIELDS: ReadonlyArray<string> = [
  'type',
  'id',
  'version',
  'name',
  'description',
  'model',
  'system',
  'tools',
  'mcp_servers',
  'skills',
  'multiagent',
  'execution_identity',
];

const MUTABLE_SESSION_AGENT_FIELDS: ReadonlySet<string> = new Set(['tools', 'mcp_servers']);
const TITLE_MAX_CHARS = 500;

export function sessionAgent(agent: ManagedDocument): ManagedDocument {
  return Record.fromEntries(SNAPSHOT_FIELDS.map((field) => [field, agent[field]] as const));
}

export function sessionTitle(title: unknown): string | null {
  if (title === null || title === undefined) {
    return null;
  }

  if (typeof title !== 'string' || title.length > TITLE_MAX_CHARS) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid session title');
  }

  return title;
}

export function updateSessionAgent(agent: ManagedDocument, update: unknown): ManagedDocument {
  if (!isManagedDocument(update) || Record.keys(update).some((key) => !MUTABLE_SESSION_AGENT_FIELDS.has(key))) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Only tools and MCP servers can change on a session');
  }

  const definition = agentDefinition({ previous: agent, patch: update, isOverride: true });

  validateEffectiveToolsets({ definition });

  return sessionAgent(definition);
}
