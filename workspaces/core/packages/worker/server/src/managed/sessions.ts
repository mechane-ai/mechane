import { workerSessionSkills } from '@mechane/control-store';
import { HttpStatusCode, wireStruct } from '@mechane/records';
import { assertManagedBudgetModels, preflightManagedEvents } from '@mechane/runtime';
import type { RuntimeConfiguration } from '@mechane/runtime';
import { Schema } from 'effect';
import { normalizeManagedAgentFields } from './agents.ts';
import { ManagedHttpError } from './http-error.ts';
import { managedPageQuery } from './page-query.ts';
import { sessionResources } from './session-resources.ts';
import { bindSessionRuntime } from './session-runtime.ts';
import type { ManagedRequest } from './types.ts';

const Document = Schema.Record(Schema.String, Schema.Unknown);
const Documents = Schema.Array(Document);
const Coordinator = Schema.Struct({ agents: Documents });

function validatePinnedAgent(agent: ManagedRequest['body'], configuration: RuntimeConfiguration): void {
  normalizeManagedAgentFields(agent, configuration);

  if (agent['multiagent'] !== null && agent['multiagent'] !== undefined) {
    const coordinator = Schema.decodeUnknownSync(Coordinator)(agent['multiagent']);

    for (const child of coordinator.agents) {
      normalizeManagedAgentFields(child, configuration);
    }
  }
}

function selectAgent(value: unknown, configuration: RuntimeConfiguration) {
  if (typeof value === 'string') {
    return { agentId: value };
  }

  const { type: _type, id, version, ...fields } = Schema.decodeUnknownSync(Document)(value);
  const agentId = Schema.decodeUnknownSync(Schema.NonEmptyString)(id);
  const selection = { agentId, overrides: normalizeManagedAgentFields(fields, configuration) };

  if (version === undefined) {
    return selection;
  }

  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Agent version must be a positive integer');
  }

  return { ...selection, version };
}

async function createSession(input: ManagedRequest) {
  const { agent, environment_id: environment, initial_events: initial, ...configuration } = input.body;
  const selection = selectAgent(agent, input.configuration);
  const environmentId = Schema.decodeUnknownSync(Schema.NonEmptyString)(environment);
  const initialEvents = Schema.decodeUnknownSync(Documents)(initial ?? []);

  preflightManagedEvents(initialEvents, true);

  const session = await input.store.managed.sessions.create({
    ...selection,
    scope: input.scope,
    configuration,
    environmentId,
    initialEvents,
    allowedGitHostnames: input.configuration.managedGit.allowedHostnames,
    validatePinnedAgent: (pinned) => validatePinnedAgent(pinned, input.configuration),
    validateBudgetModels: (pinned) => assertManagedBudgetModels(input.configuration, pinned),
  });

  const id = Schema.decodeUnknownSync(Schema.NonEmptyString)(session['id']);

  input.scheduleSessionOpen({ scope: input.scope, id });

  return session;
}

const SessionFilters = wireStruct({
  fields: {
    agentId: Schema.optionalKey(Schema.String),
    agentVersion: Schema.optionalKey(Schema.Int),
    order: Schema.optionalKey(Schema.Literals(['asc', 'desc'])),
    deploymentId: Schema.optionalKey(Schema.String),
    memoryStoreId: Schema.optionalKey(Schema.String),
  },
});

function sessionQuery(query: ManagedRequest['query']) {
  const filters = Schema.decodeUnknownSync(SessionFilters)(query);
  const page = { ...managedPageQuery(query), ...filters };

  if (query['statuses[]'] === undefined) {
    return page;
  }

  const statuses = Schema.decodeUnknownSync(Schema.Array(Schema.String))(query['statuses[]']);

  return { ...page, statuses };
}

const resourceOperations: ReadonlySet<string> = new Set([
  'BetaAddResource',
  'BetaGetResource',
  'BetaListResources',
  'BetaUpdateResource',
  'BetaDeleteResource',
]);

const lifecycleMutations = { BetaArchiveSession: 'archive', BetaDeleteSession: 'delete' } as const;

export async function handleSessions(input: ManagedRequest): Promise<unknown> {
  const { operation, scope, store } = input;
  const sessions = store.managed.sessions;

  if (operation === 'BetaCreateSession') {
    return await createSession(input);
  }

  if (operation === 'BetaListSessions') {
    return await sessions.list({ scope, query: sessionQuery(input.query) });
  }

  const id = input.params['session_id'];

  if (id === undefined || id.length === 0) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'A session ID is required');
  }

  if (resourceOperations.has(operation)) {
    return await sessionResources(input, id);
  }

  const { runtime, environmentId } = await bindSessionRuntime(input, id);
  const target = { scope, id };

  switch (operation) {
    case 'BetaGetSession': {
      const state = await runtime.read({ sessionId: id });
      const session = await sessions.get(target);

      const current = {
        ...session,
        status: state.status,
        outcome_evaluations: state.outcome_evaluations ?? session['outcome_evaluations'],
      };

      if (input.workerSession !== undefined) {
        return workerSessionSkills(current);
      }

      return current;
    }
    case 'BetaUpdateSession': {
      const changes = { ...input.body };

      if (changes['agent'] !== undefined) {
        const agent = Schema.decodeUnknownSync(Document)(changes['agent']);
        changes['agent'] = normalizeManagedAgentFields(agent, input.configuration);
      }

      return await runtime.mutateSession({
        sessionId: id,
        mutationId: crypto.randomUUID(),
        principalId: scope.principalId,
        isAdmin: scope.isAdmin,
        kind: 'update',
        changes,
      });
    }
    case 'BetaArchiveSession':
    case 'BetaDeleteSession': {
      const result = await runtime.mutateSession({
        sessionId: id,
        mutationId: crypto.randomUUID(),
        principalId: scope.principalId,
        isAdmin: scope.isAdmin,
        kind: lifecycleMutations[operation],
      });

      input.wakeInstalledSession({ workspaceId: scope.workspaceId, environmentId, sessionId: id });

      return result;
    }
    default:
      throw new ManagedHttpError(HttpStatusCode.NotFound, 'Unknown session operation');
  }
}
