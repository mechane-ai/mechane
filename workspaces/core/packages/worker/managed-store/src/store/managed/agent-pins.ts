import { managedDocument, ManagedStoreError } from '@mechane/authority-store';
import type { ManagedDocument, ManagedScope, StoreContext } from '@mechane/authority-store';
import { HttpStatusCode } from '@mechane/records';
import { agentDefinition, validateEffectiveToolsets } from './agent-definition.ts';
import { loadAgent } from './agent-lookup.ts';
import type { AgentLookup, AgentRow } from './agent-lookup.ts';
import { resolveAgentSkills } from './skills.ts';

type AgentSnapshotInput = {
  readonly context: StoreContext;
  readonly scope: ManagedScope;
  readonly id: string;
  readonly version: number;
  readonly definition: ManagedDocument;
};

async function agentSnapshot({
  context,
  scope,
  id,
  version,
  definition,
}: AgentSnapshotInput): Promise<ManagedDocument> {
  const skills = await resolveAgentSkills({ context, scope, skills: definition['skills'], shouldPinLatest: true });
  const { metadata: _metadata, multiagent: _multiagent, ...settings } = definition;

  return { ...settings, type: 'agent', id, version, skills };
}

type ChildMember = { readonly agent: ManagedDocument; readonly id: string; readonly runtimeId: string };

type ResolveChildInput = {
  readonly context: StoreContext;
  readonly scope: ManagedScope;
  readonly entry: unknown;
  readonly row: AgentRow;
  readonly primary: ManagedDocument;
};

async function resolveChild({ context, scope, entry, row, primary }: ResolveChildInput): Promise<ChildMember> {
  const reference = managedDocument(entry, 'agent');
  const id = reference['id'];
  const version = reference['version'];

  if (typeof id !== 'string' || typeof version !== 'number') {
    throw new TypeError('Invalid stored coordinator reference');
  }

  if (id === row.id && version === row.version) {
    return { agent: primary, id, runtimeId: row.runtime_id };
  }

  const child = await loadAgent(context, { scope, id, version });

  const agent = await agentSnapshot({
    context,
    scope,
    id: child.id,
    version: child.version,
    definition: child.definition,
  });

  return { agent, id: child.id, runtimeId: child.runtime_id };
}

type PinManagedAgentInput = AgentLookup & {
  readonly context: StoreContext;
  readonly overrides?: ManagedDocument | undefined;
};

type PinnedAgent = {
  readonly agent: ManagedDocument;
  readonly runtimeMechId: string;
  readonly childRuntimeMechIds: Readonly<Record<string, string>>;
};

export async function pinManagedAgent({
  context,
  scope,
  id,
  version,
  overrides = {},
}: PinManagedAgentInput): Promise<PinnedAgent> {
  const row = await loadAgent(context, { scope, id, version }, 'share');

  if (row.archived_at !== null) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Cannot start a session with an archived agent');
  }

  const definition = agentDefinition({ previous: row.definition, patch: overrides, isOverride: true });

  validateEffectiveToolsets({ definition });

  const primary = await agentSnapshot({ context, scope, id, version: row.version, definition });
  const childRuntimeMechIds: Record<string, string> = {};
  const coordinator = definition['multiagent'];

  if (coordinator === null) {
    return { runtimeMechId: row.runtime_id, childRuntimeMechIds, agent: { ...primary, multiagent: null } };
  }

  const roster = managedDocument(coordinator, 'multiagent')['agents'];

  if (!Array.isArray(roster)) {
    throw new TypeError('Stored coordinator is missing its roster');
  }

  const agents: Array<ManagedDocument> = [];

  for (const entry of roster) {
    const member = await resolveChild({ context, scope, entry, row, primary });

    agents.push(member.agent);

    childRuntimeMechIds[member.id] = member.runtimeId;
  }

  return {
    runtimeMechId: row.runtime_id,
    childRuntimeMechIds,
    agent: { ...primary, multiagent: { type: 'coordinator', agents } },
  };
}
