import { HttpStatusCode } from '@mechane/records';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { saveRevision } from '../api/mechs/mechs.ts';
import type { StoreContext } from '../context.ts';
import { lockWorkspace } from '../scope-locks.ts';
import { agentDefinition, validateEffectiveToolsets } from './agent-definition.ts';
import { listAgents, listAgentVersions, loadAgent, publicAgent } from './agent-lookup.ts';
import type { AgentLookup } from './agent-lookup.ts';
import { pinRoster, rebindSelf } from './agent-roster.ts';
import { managedDocument, managedId, ManagedStoreError } from './managed-record.ts';
import { resolveAgentSkills } from './skills.ts';
import type { ManagedDocument, ManagedScope } from './types.ts';

type CreateAgent = {
  readonly scope: ManagedScope;
  readonly definition: ManagedDocument;
  readonly normalizeModel: (value: unknown) => ManagedDocument;
};

type UpdateAgent = CreateAgent & { readonly id: string; readonly expectedVersion?: number };
type ResourceReference = { readonly id: string; readonly scope: ManagedScope };
type AgentVersion = { readonly id: string; readonly version: number; readonly definition: ManagedDocument };
type SaveVersionInput = AgentVersion & { readonly context: StoreContext };

async function saveVersion({ context, id, version, definition }: SaveVersionInput): Promise<void> {
  await context.client.query(
    'INSERT INTO mechane.managed_agent_versions(agent_id,version,definition) VALUES($1,$2,$3::jsonb)',
    [id, version, JSON.stringify(definition)],
  );
}

type DefinitionToSaveInput = AgentVersion &
  Pick<CreateAgent, 'normalizeModel'> & {
    readonly context: StoreContext;
    readonly scope: ManagedScope;
    readonly previous?: ManagedDocument;
  };

async function definitionToSave({
  context,
  scope,
  id,
  version,
  definition,
  previous,
  normalizeModel,
}: DefinitionToSaveInput): Promise<ManagedDocument> {
  const result = agentDefinition({ previous, patch: definition });

  validateEffectiveToolsets({ definition: result });

  const normalized = { ...result };

  if (previous === undefined || Object.hasOwn(definition, 'model')) {
    normalized['model'] = normalizeModel(result['model']);
  }

  if (previous === undefined || Object.hasOwn(definition, 'skills')) {
    normalized['skills'] = await resolveAgentSkills({ context, scope, skills: result['skills'] });
  }

  if (previous === undefined || Object.hasOwn(definition, 'multiagent')) {
    normalized['multiagent'] = await pinRoster({ context, scope, id, version, configuration: result['multiagent'] });
  }

  return normalized;
}

async function createAgent(context: StoreContext, input: CreateAgent): Promise<ManagedDocument> {
  const { scope } = input;

  await lockWorkspace({ client: context.client, workspaceId: scope.workspaceId });

  const id = managedId('agent');
  const definition = await definitionToSave({ context, ...input, id, version: 1 });
  const model = managedDocument(definition['model'], 'model');

  if (typeof definition['name'] !== 'string' || typeof model['id'] !== 'string') {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Agent name and model are required');
  }

  const runtimeId = randomUUID();

  await context.client.query(
    `
    INSERT INTO mechane.mechs(id,workspace_id,name,model,daily_cap_micros,status,revision,creation_request_id,
      creation_fingerprint,creator_id,updater_id)
    SELECT $1,id,$2,$3,daily_cap_micros,'active',1,$1,$2,$4,$4 FROM mechane.workspaces WHERE id=$5`,
    [runtimeId, id, model['id'], scope.principalId, scope.workspaceId],
  );
  await saveRevision(context, runtimeId);
  await context.client.query(
    'INSERT INTO mechane.managed_agents(workspace_id,creator_id,id,runtime_id,version) VALUES($1,$2,$3,$4,1)',
    [scope.workspaceId, scope.principalId, id, runtimeId],
  );
  await saveVersion({ context, id, version: 1, definition });

  return publicAgent(await loadAgent(context, { scope, id }));
}

async function updateAgent(context: StoreContext, input: UpdateAgent): Promise<ManagedDocument> {
  const { scope, id, expectedVersion } = input;

  await lockWorkspace({ client: context.client, workspaceId: scope.workspaceId });

  const current = await loadAgent(context, { scope, id }, true);

  if (current.archived_at !== null) {
    throw new ManagedStoreError(HttpStatusCode.Conflict, 'Archived agents are read-only');
  }

  if (expectedVersion !== undefined && expectedVersion !== current.version) {
    throw new ManagedStoreError(HttpStatusCode.Conflict, 'Agent version has changed');
  }

  const candidate = await definitionToSave({
    context,
    ...input,
    version: current.version,
    previous: current.definition,
  });

  if (isDeepStrictEqual(candidate, current.definition)) {
    return publicAgent(current);
  }

  const version = current.version + 1;
  const definition = rebindSelf({ definition: candidate, id, version });

  await saveVersion({ context, id, version, definition });
  await context.client.query('UPDATE mechane.managed_agents SET version=$2 WHERE id=$1', [id, version]);

  return publicAgent(await loadAgent(context, { scope, id }));
}

async function archiveAgent(context: StoreContext, input: ResourceReference): Promise<ManagedDocument> {
  await lockWorkspace({ client: context.client, workspaceId: input.scope.workspaceId });

  const current = await loadAgent(context, input, true);

  if (current.archived_at === null) {
    await context.client.query('UPDATE mechane.managed_agents SET archived_at=now() WHERE id=$1', [input.id]);
  }

  return publicAgent(await loadAgent(context, input));
}

export function createManagedAgentStore(context: StoreContext) {
  return {
    create: (input: CreateAgent) => context.atomic((transaction) => createAgent(transaction, input)),
    update: (input: UpdateAgent) => context.atomic((transaction) => updateAgent(transaction, input)),
    archive: (input: ResourceReference) => context.atomic((transaction) => archiveAgent(transaction, input)),
    get: async (input: AgentLookup) => publicAgent(await loadAgent(context, input)),
    list: (input: Parameters<typeof listAgents>[1]) => listAgents(context, input),
    versions: (input: Parameters<typeof listAgentVersions>[1]) => listAgentVersions(context, input),
  };
}
