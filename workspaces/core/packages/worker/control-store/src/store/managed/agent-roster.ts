import { HttpStatusCode } from '@mechane/records';
import type { StoreContext } from '../context.ts';
import { loadAgent } from './agent-lookup.ts';
import { managedDocument, ManagedStoreError } from './managed-record.ts';
import type { ManagedDocument, ManagedScope } from './types.ts';

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
  const roster = value['agents'];

  if (value['type'] !== 'coordinator' || Object.hasOwn(value, 'advisor')) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Expected a coordinator without an advisor');
  }

  if (!Array.isArray(roster) || roster.length === 0 || roster.length > COORDINATOR_MAX_ENTRIES) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Expected one to twenty predefined coordinator agents');
  }

  const seen = new Set<string>();
  const agents: Array<RosterEntry> = [];

  for (const entry of roster) {
    const resolved = await resolveEntry({ context, scope, id, version, entry });

    if (seen.has(resolved.id)) {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Expected distinct agent references');
    }

    seen.add(resolved.id);
    agents.push(resolved);
  }

  return { type: 'coordinator', agents };
}

type RebindSelfInput = { readonly definition: ManagedDocument; readonly id: string; readonly version: number };

export function rebindSelf({ definition, id, version }: RebindSelfInput): ManagedDocument {
  const configuration = definition['multiagent'];

  if (configuration === null) {
    return definition;
  }

  const roster = managedDocument(configuration, 'multiagent')['agents'];

  if (!Array.isArray(roster)) {
    throw new TypeError('Stored coordinator is missing its roster');
  }

  const agents = roster.map((entry) => {
    const reference = managedDocument(entry, 'agent');

    if (reference['id'] === id) {
      return { type: 'agent', id, version };
    }

    return reference;
  });

  return { ...definition, multiagent: { type: 'coordinator', agents } };
}
