import { managedModelSettings } from '@mechane/model-gateway';
import { HttpStatusCode } from '@mechane/records';
import { resolveManagedToolsets, validateManagedMcpServers } from '@mechane/runtime';
import type { RuntimeConfiguration } from '@mechane/runtime';
import { Predicate, Record, Schema } from 'effect';
import { ManagedHttpError } from './http-error.ts';
import { managedPageQuery } from './page-query.ts';
import type { ManagedRequest } from './types.ts';

const AgentListFilters = Schema.Struct({
  search: Schema.optionalKey(Schema.String),
  filter: Schema.optionalKey(Schema.Literals(['active', 'archived'])),
});

const METADATA_KEY_MAX_CHARACTERS = 64;
const METADATA_VALUE_MAX_CHARACTERS = 512;

function invalidDefinition(message: string): never {
  throw new ManagedHttpError(HttpStatusCode.BadRequest, message);
}

function versionNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return invalidDefinition('Agent version must be a positive integer');
  }

  return value;
}

function validateMetadata(metadata: unknown): void {
  if (!Predicate.isObject(metadata)) {
    return;
  }

  for (const [key, value] of Record.toEntries(metadata)) {
    if (
      Array.from(key).length > METADATA_KEY_MAX_CHARACTERS ||
      (typeof value === 'string' && Array.from(value).length > METADATA_VALUE_MAX_CHARACTERS)
    ) {
      invalidDefinition('Agent metadata keys may contain up to 64 characters and values up to 512 characters');
    }
  }
}

function normalizeTools(raw: unknown, configuration: RuntimeConfiguration) {
  try {
    return resolveManagedToolsets(raw ?? [], configuration.managedWeb);
  } catch (error) {
    if (error instanceof Error) {
      return invalidDefinition(error.message);
    }

    throw error;
  }
}

function definitionFields(fields: ManagedRequest['body'], configuration: RuntimeConfiguration): ManagedRequest['body'] {
  const definition = { ...fields };

  if (fields['execution_identity'] !== undefined) {
    const identity = fields['execution_identity'] ?? { type: 'service_account' };

    if (!Predicate.isObject(identity) || identity['type'] !== 'service_account') {
      return invalidDefinition('This installation supports service_account execution identity');
    }

    definition['execution_identity'] = identity;
  }

  if (fields['tools'] !== undefined) {
    definition['tools'] = normalizeTools(fields['tools'], configuration);
  }

  if (fields['mcp_servers'] !== undefined) {
    const servers = fields['mcp_servers'] ?? [];
    const error = validateManagedMcpServers(servers, configuration.managedMcp);

    if (error !== null) {
      return invalidDefinition(error);
    }

    definition['mcp_servers'] = servers;
  }

  if (fields['system'] === '') {
    definition['system'] = null;
  }

  if (fields['description'] === '') {
    definition['description'] = null;
  }

  validateMetadata(fields['metadata']);

  return definition;
}

export function normalizeManagedAgentFields(
  fields: ManagedRequest['body'],
  configuration: RuntimeConfiguration,
): ManagedRequest['body'] {
  const definition = definitionFields(fields, configuration);

  if (fields['model'] !== undefined) {
    return {
      ...definition,
      model: managedModelSettings({ offers: configuration.model.offers, value: fields['model'] }),
    };
  }

  return definition;
}

export async function handleAgents({
  operation,
  params,
  query,
  body,
  scope,
  store,
  configuration,
}: ManagedRequest): Promise<unknown> {
  const agents = store.managed.agents;

  function normalizeModel(value: unknown) {
    return managedModelSettings({ offers: configuration.model.offers, value });
  }

  if (operation === 'BetaCreateAgent') {
    const definition = definitionFields(body, configuration);

    return await agents.create({ scope, definition, normalizeModel });
  }

  if (operation === 'BetaListAgents') {
    const page = { ...managedPageQuery(query), ...Schema.decodeUnknownSync(AgentListFilters)(query) };

    return await agents.list({ scope, query: page });
  }

  const id = params['agent_id'];

  if (id === undefined || id.length === 0) {
    return invalidDefinition('An agent ID is required');
  }

  switch (operation) {
    case 'BetaGetAgent':
      if (query['version'] === undefined) {
        return await agents.get({ scope, id });
      }

      return await agents.get({ scope, id, version: versionNumber(query['version']) });

    case 'BetaUpdateAgent': {
      const { version, ...fields } = body;
      const definition = definitionFields(fields, configuration);

      if (version === undefined) {
        return await agents.update({ scope, id, definition, normalizeModel });
      }

      return await agents.update({ scope, id, definition, normalizeModel, expectedVersion: versionNumber(version) });
    }
    case 'BetaArchiveAgent':
      return await agents.archive({ scope, id });
    case 'BetaListAgentVersions':
      return await agents.versions({ scope, id, query: managedPageQuery(query) });
    default:
      throw new ManagedHttpError(HttpStatusCode.NotFound, 'Unknown agent operation');
  }
}
