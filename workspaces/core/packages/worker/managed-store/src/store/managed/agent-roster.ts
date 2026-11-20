import { managedDocument, ManagedStoreError } from '@mechane/authority-store';
import type { ManagedDocument, ManagedScope, StoreContext } from '@mechane/authority-store';
import { HttpStatusCode } from '@mechane/records';
import { loadAgent } from './agent-lookup.ts';

const COORDINATOR_MAX_ENTRIES = 20;

type RosterEntry = { readonly type: 'agent'; readonly id: string; readonly version: number };

type AgentOwner = {
  readonly context: StoreContext;
  readonly scope: ManagedScope;
  readonly id: string;
  readonly version: number;
};

type ResolveEntryInput = AgentOwner & { readonly entry: unknown };
type PinRosterInput = AgentOwner & { readonly configuration: unknown };

type AgentReferenceInput = { readonly entry: unknown };

function agentReference({ entry }: AgentReferenceInput): ManagedDocument {
  if (typeof entry === 'string') {
    return { type: 'agent', id: entry };
  }

  return managedDocument(entry, 'agent');
}

async function resolveEntry({ context, scope, id, version, entry }: ResolveEntryInput): Promise<RosterEntry> {
  const reference = agentReference({ entry });

  if (reference['type'] === 'self') {
    return { type: 'agent', id, version };
  }

  const target = reference['id'];
  const requested = reference['version'];

  if (reference['type'] !== 'agent' || typeof target !== 'string' || target === id) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid coordinator agent reference');
  }

  if (requested !== undefined) {
    if (typeof requested !== 'number' || !Number.isSafeInteger(requested) || requested < 1) {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid coordinator agent version');
    }
  }

  const child = await loadAgent(context, { scope, id: target, version: requested });

  if (child.archived_at !== null || child.definition['multiagent'] !== null) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Subagent must be active and single-agent');
  }

  return { type: 'agent', id: target, version: child.version };
}

async function resolveRoster(owner: AgentOwner, roster: unknown): Promise<ReadonlyArray<RosterEntry>> {
  if (!Array.isArray(roster) || roster.length === 0 || roster.length > COORDINATOR_MAX_ENTRIES) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Expected one to twenty predefined coordinator agents');
  }

  const seen = new Set<string>();
  const agents: Array<RosterEntry> = [];

  for (const entry of roster) {
    const resolved = await resolveEntry({ ...owner, entry });

    if (seen.has(resolved.id)) {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Expected distinct agent references');
    }

    seen.add(resolved.id);
    agents.push(resolved);
  }

  return agents;
}

function assertDisabledFeature(value: unknown, field: string, message: string): void {
  if (value === undefined || value === null) {
    return;
  }

  const parsed = managedDocument(value, field);

  if (parsed['type'] !== 'disabled') {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, message);
  }
}

async function pinMultiagent20261001(owner: AgentOwner, value: ManagedDocument): Promise<ManagedDocument> {
  assertDisabledFeature(value['workflows'], 'workflows', 'Workflows are not supported in multiagent_20261001');
  assertDisabledFeature(value['advisor'], 'advisor', 'Advisor is not supported in multiagent_20261001');

  const rawSubagents = value['subagents'];

  if (rawSubagents === undefined || rawSubagents === null) {
    return {
      type: 'multiagent_20261001',
      workflows: { type: 'disabled' },
      subagents: { type: 'disabled' },
      advisor: { type: 'disabled' },
    };
  }

  const subagents = managedDocument(rawSubagents, 'subagents');

  if (subagents['type'] === 'disabled') {
    return {
      type: 'multiagent_20261001',
      workflows: { type: 'disabled' },
      subagents: { type: 'disabled' },
      advisor: { type: 'disabled' },
    };
  }

  if (subagents['type'] !== 'enabled') {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid multiagent_20261001 subagents configuration');
  }

  assertDisabledFeature(
    subagents['inline_agents'],
    'inline_agents',
    'Inline subagents are not supported; supply predefined_agents',
  );

  const agents = await resolveRoster(owner, subagents['predefined_agents']);

  return {
    type: 'multiagent_20261001',
    workflows: { type: 'disabled' },
    subagents: { type: 'enabled', inline_agents: { type: 'disabled' }, predefined_agents: agents },
    advisor: { type: 'disabled' },
  };
}

export async function pinRoster({
  context,
  scope,
  id,
  version,
  configuration,
}: PinRosterInput): Promise<ManagedDocument | null> {
  if (configuration === null) {
    return null;
  }

  const value = managedDocument(configuration, 'multiagent');
  const owner = { context, scope, id, version };

  if (value['type'] === 'multiagent_20261001') {
    return await pinMultiagent20261001(owner, value);
  }

  if (value['type'] !== 'coordinator' || Object.hasOwn(value, 'advisor')) {
    throw new ManagedStoreError(
      HttpStatusCode.BadRequest,
      'Expected a coordinator or multiagent_20261001 configuration',
    );
  }

  const agents = await resolveRoster(owner, value['agents']);

  return { type: 'coordinator', agents };
}

type RebindSelfInput = { readonly definition: ManagedDocument; readonly id: string; readonly version: number };

function rebindEntries(roster: unknown, id: string, version: number): ReadonlyArray<ManagedDocument> {
  if (!Array.isArray(roster)) {
    throw new TypeError('Stored coordinator is missing its roster');
  }

  return roster.map((entry) => {
    const reference = managedDocument(entry, 'agent');

    if (reference['id'] === id) {
      return { type: 'agent', id, version };
    }

    return reference;
  });
}

export function rebindSelf({ definition, id, version }: RebindSelfInput): ManagedDocument {
  const configuration = definition['multiagent'];

  if (configuration === null) {
    return definition;
  }

  const parsed = managedDocument(configuration, 'multiagent');

  if (parsed['type'] === 'multiagent_20261001') {
    const subagents = managedDocument(parsed['subagents'], 'subagents');

    if (subagents['type'] !== 'enabled') {
      return definition;
    }

    const predefined = rebindEntries(subagents['predefined_agents'], id, version);

    return { ...definition, multiagent: { ...parsed, subagents: { ...subagents, predefined_agents: predefined } } };
  }

  const agents = rebindEntries(parsed['agents'], id, version);

  return { ...definition, multiagent: { type: 'coordinator', agents } };
}
