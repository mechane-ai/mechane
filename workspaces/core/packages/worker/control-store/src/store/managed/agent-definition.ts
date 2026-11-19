import { HttpStatusCode } from '@mechane/records';
import { Record } from 'effect';
import { isManagedDocument, managedDocument, ManagedStoreError } from './managed-record.ts';
import type { ManagedDocument } from './types.ts';
import { checkedMetadata, patchMetadata } from './vault-fields.ts';

const DEFINITION_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'model',
  'description',
  'execution_identity',
  'mcp_servers',
  'metadata',
  'multiagent',
  'skills',
  'system',
  'tools',
]);

const OVERRIDE_FIELDS: ReadonlySet<string> = new Set(['model', 'system', 'skills', 'tools', 'mcp_servers']);

const DEFINITION_DEFAULTS = {
  description: null,
  execution_identity: { type: 'service_account' },
  mcp_servers: [],
  metadata: {},
  multiagent: null,
  skills: [],
  system: null,
  tools: [],
} as const;

type AgentDefinitionInput = {
  readonly previous?: ManagedDocument | undefined;
  readonly patch: ManagedDocument;
  readonly isOverride?: boolean;
};

type EffectiveModelInput = { readonly previous: unknown; readonly model: unknown; readonly isOverride: boolean };

type ModelDocumentInput = { readonly value: unknown };

function modelDocument({ value }: ModelDocumentInput): ManagedDocument {
  if (typeof value === 'string') {
    return { id: value };
  }

  if (!isManagedDocument(value)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'agent_model_required');
  }

  return value;
}

function effectiveModel({ previous, model: value, isOverride }: EffectiveModelInput): ManagedDocument {
  const model = modelDocument({ value });

  if (typeof model['id'] !== 'string' || model['id'].length === 0) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'agent_model_required');
  }

  const normalized = { speed: 'standard', ...model };

  if (isOverride || model['effort'] !== undefined || !isManagedDocument(previous)) {
    return normalized;
  }

  if (previous['id'] === model['id'] && previous['effort'] !== undefined) {
    return { ...normalized, effort: previous['effort'] };
  }

  return normalized;
}

export function agentDefinition({ previous, patch, isOverride = false }: AgentDefinitionInput): ManagedDocument {
  const keys = Record.keys(patch);

  if (keys.some((field) => !DEFINITION_FIELDS.has(field))) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Unknown agent field');
  }

  if (isOverride && keys.some((field) => !OVERRIDE_FIELDS.has(field))) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Unknown agent override');
  }

  const merged: ManagedDocument = { ...DEFINITION_DEFAULTS, ...previous, ...patch };

  if (typeof merged['name'] !== 'string' || merged['name'].length === 0) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Agent name must be a nonempty string');
  }

  const model = effectiveModel({ previous: previous?.['model'], model: merged['model'], isOverride });
  const storedMetadata = checkedMetadata(previous?.['metadata']);
  const metadata = patchMetadata(storedMetadata, patch['metadata']);

  return {
    ...merged,
    model,
    metadata,
    tools: merged['tools'] ?? [],
    skills: merged['skills'] ?? [],
    mcp_servers: merged['mcp_servers'] ?? [],
  };
}

type CanReadFilesInput = { readonly tool: ManagedDocument };

function canReadFiles({ tool }: CanReadFilesInput): boolean {
  const configurations = tool['configs'];

  if (Array.isArray(configurations)) {
    const override: unknown = configurations.find(
      (configuration) => isManagedDocument(configuration) && configuration['name'] === 'read',
    );

    if (isManagedDocument(override) && typeof override['enabled'] === 'boolean') {
      return override['enabled'];
    }
  }

  const defaults = tool['default_config'];

  return !isManagedDocument(defaults) || defaults['enabled'] !== false;
}

type ValidateEffectiveToolsetsInput = { readonly definition: ManagedDocument };

export function validateEffectiveToolsets({ definition }: ValidateEffectiveToolsetsInput): void {
  const servers = definition['mcp_servers'];
  const tools = definition['tools'];

  if (!Array.isArray(servers) || !Array.isArray(tools)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid agent toolsets');
  }

  const serverNames = new Set<string>();

  for (const server of servers) {
    if (!isManagedDocument(server) || typeof server['name'] !== 'string' || serverNames.has(server['name'])) {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'MCP server names must be distinct');
    }

    serverNames.add(server['name']);
  }

  const referenced = new Set<string>();
  let canRead = false;

  for (const raw of tools) {
    const tool = managedDocument(raw, 'tool');

    if (tool['type'] === 'mcp_toolset') {
      const name = tool['mcp_server_name'];

      if (typeof name !== 'string' || !serverNames.has(name)) {
        throw new ManagedStoreError(HttpStatusCode.BadRequest, 'MCP toolset references an unknown server');
      }

      referenced.add(name);
    }

    if (tool['type'] === 'agent_toolset_20260401' && canReadFiles({ tool })) {
      canRead = true;
    }
  }

  if (referenced.size !== serverNames.size) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Each MCP server requires a matching toolset');
  }

  if (Array.isArray(definition['skills']) && definition['skills'].length > 0 && !canRead) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Agent skills require the read tool');
  }
}
