import { managedBudgetCents, managedId, ManagedStoreError } from '@mechane/authority-store';
import type { CredentialKeyring, ManagedDocument, ManagedScope, StoreContext } from '@mechane/authority-store';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { pinManagedAgent } from './agent-pins.ts';
import { sessionAgent, sessionTitle } from './session-configuration.ts';
import { readSession, sessionDocument } from './session-records.ts';
import { describeSkillMounts } from './skill-mounts.ts';
import { checkedMetadata } from './vault-fields.ts';
import { prepareSessionResources, validateSessionVaults } from './vault-resources.ts';
import { registerManagedSessionWork } from './work-records.ts';

export type BudgetModelValidator = (agent: ManagedDocument) => void | Promise<void>;

type SessionCreate = {
  readonly scope: ManagedScope;
  readonly agentId: string;
  readonly version?: number;
  readonly environmentId: string;
  readonly overrides?: ManagedDocument;
  readonly configuration: ManagedDocument;
  readonly initialEvents?: ReadonlyArray<ManagedDocument>;
  readonly allowedGitHostnames?: ReadonlyArray<string>;
  readonly validatePinnedAgent?: (agent: ManagedDocument) => void;
  readonly validateBudgetModels?: BudgetModelValidator;
};

const INITIAL_EVENT_TYPES: ReadonlySet<unknown> = new Set(['user.message', 'user.define_outcome']);
const INITIAL_EVENT_MAX_ITEMS = 50;

function checkedInitialEvents(value: unknown): ReadonlyArray<ManagedDocument> {
  if (value === undefined) {
    return [];
  }

  if (
    !Schema.is(Schema.Array(Schema.Record(Schema.String, Schema.Unknown)))(value) ||
    value.length > INITIAL_EVENT_MAX_ITEMS
  ) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid initial events');
  }

  for (const event of value) {
    if (!INITIAL_EVENT_TYPES.has(event['type'])) {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Unsupported initial event');
    }
  }

  return value;
}

function initialStatus(events: ReadonlyArray<ManagedDocument>) {
  if (events.length === 0) {
    return 'idle';
  }

  return 'running';
}

export async function requireBudgetable(agent: ManagedDocument, validate?: BudgetModelValidator): Promise<void> {
  if (validate === undefined) {
    throw new ManagedStoreError(
      HttpStatusCode.BadRequest,
      'Budgeted sessions require models with a known public price',
    );
  }

  await validate(agent);
}

export async function createSession(transaction: StoreContext, keyring: CredentialKeyring, input: SessionCreate) {
  const { scope, agentId, environmentId, configuration } = input;

  const pinned = await pinManagedAgent({
    context: transaction,
    scope,
    id: agentId,
    version: input.version,
    overrides: input.overrides,
  });

  const agent = sessionAgent(pinned.agent);

  input.validatePinnedAgent?.(agent);

  await describeSkillMounts({ context: transaction, workspaceId: scope.workspaceId, agent });

  const budget = managedBudgetCents(configuration['budget']);

  if (budget !== null) {
    await requireBudgetable(agent, input.validateBudgetModels);
  }

  const foundEnvironment = await transaction.client.query(
    'SELECT id FROM mechane.managed_environments WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL FOR SHARE',
    [scope.workspaceId, environmentId],
  );

  if (foundEnvironment.rows.length === 0) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'Environment not found');
  }

  const vaults = await validateSessionVaults(transaction, scope, configuration['vault_ids']);
  const id = managedId('sesn');
  const threadId = managedId('sthr');
  const title = sessionTitle(configuration['title']);
  const metadata = checkedMetadata(configuration['metadata']);
  const initialEvents = checkedInitialEvents(input.initialEvents ?? configuration['initial_events']);
  const status = initialStatus(initialEvents);
  const descriptor = { agent, title, metadata, resources: [], vault_ids: vaults };

  await transaction.client.query(
    `INSERT INTO mechane.managed_sessions
     (workspace_id,creator_id,id,agent_id,agent_version,environment_id,runtime_mech_id,thread_id,
       configuration,initial_events,status,budget_cents,child_runtime_mech_ids,oidc_issuer,oidc_subject)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      scope.workspaceId,
      scope.principalId,
      id,
      agentId,
      agent['version'],
      environmentId,
      pinned.runtimeMechId,
      threadId,
      JSON.stringify(descriptor),
      JSON.stringify(initialEvents),
      status,
      budget,
      JSON.stringify(pinned.childRuntimeMechIds),
      scope.actorIdentity?.issuer ?? null,
      scope.actorIdentity?.subject ?? null,
    ],
  );

  const resources = await prepareSessionResources({
    context: transaction,
    keyring,
    scope,
    sessionId: id,
    resources: configuration['resources'],
    allowedGitHostnames: input.allowedGitHostnames ?? [],
  });

  if (resources.length > 0) {
    await transaction.client.query(
      "UPDATE mechane.managed_sessions SET configuration=jsonb_set(configuration,'{resources}',$3::jsonb) WHERE workspace_id=$1 AND id=$2",
      [scope.workspaceId, id, JSON.stringify(resources)],
    );
  }

  await registerManagedSessionWork(transaction, { workspaceId: scope.workspaceId, sessionId: id });

  const row = await readSession(transaction, { scope, id });

  return await sessionDocument(transaction, row);
}
