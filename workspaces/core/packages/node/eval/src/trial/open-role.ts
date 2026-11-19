import { DateTime, Effect, Option, Predicate, Schema } from 'effect';
import { isDeepStrictEqual } from 'node:util';
import type { EvalToolDefinition, RoleIntent, RoleReceipt } from '../application-schemas.ts';
import type { RoleContext } from '../application-types.ts';
import type { EvalRole } from '../constants.ts';
import type { EvalAdapterFailed } from '../errors.ts';
import { managedRequest } from '../managed-request.ts';
import type { EvalRunFailure } from '../types.ts';
import { selectRoleFiles } from './role-files.ts';
import { isOwned, openRoleResource, provisioningIssue } from './role-resources.ts';
import type { EvalSession } from './role-resources.ts';

type OpenRole = {
  readonly context: RoleContext;
  readonly role: EvalRole;
  readonly intent: RoleIntent;
  readonly tools: ReadonlyArray<EvalToolDefinition>;
};

const OBJECT_SCHEMA = 'object';
const SELF_HOSTED = 'self_hosted';
const IDLE = 'idle';
const DEFAULT_IDENTITY = { type: 'service_account' } as const;
const MICROS_PER_CENT = 10_000;

const CustomInput = Schema.StructWithRest(
  Schema.Struct({
    type: Schema.Literal(OBJECT_SCHEMA),
    required: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
    properties: Schema.optionalKey(Schema.Record(Schema.String, Schema.Json)),
  }),
  [Schema.Record(Schema.String, Schema.Json)],
);

type CustomToolKind = { readonly type: 'custom' };
type CustomTool = Extract<EvalSession['agent']['tools'][number], CustomToolKind>;
type SessionInput = { readonly session: EvalSession };
type Agent = Awaited<ReturnType<RoleContext['target']['managed']['beta']['agents']['retrieve']>>;
type AgentInput = { readonly agent: Agent | EvalSession['agent'] };

const customTool = Effect.fn('customTool')(function* (
  tool: EvalToolDefinition,
): Effect.fn.Return<CustomTool, EvalAdapterFailed> {
  const schema = yield* Schema.decodeUnknownEffect(CustomInput)(tool.inputSchema).pipe(
    Effect.mapError(() => provisioningIssue({ reason: `Invalid custom tool input schema for ${tool.name}` })),
  );

  return { type: 'custom', name: tool.name, description: tool.description, input_schema: schema };
});

const provisionRole = Effect.fn('provisionRole')(function* ({
  context,
  role,
  intent,
  tools,
}: OpenRole): Effect.fn.Return<RoleReceipt, EvalRunFailure> {
  const files = selectRoleFiles({ context, role });
  const cents = intent.capMicros / MICROS_PER_CENT;

  if (!Number.isSafeInteger(cents) || cents < 1) {
    return yield* provisioningIssue({ reason: 'Managed session budgets require a positive whole number of USD cents' });
  }

  const budget = { type: 'limit', max_list_cost: { currency: 'USD', amount: String(cents) } } as const;
  const selected = yield* Effect.forEach(tools, customTool, { concurrency: 1 });
  const instructions = Option.fromUndefinedOr(intent.settings.instructions);
  const system = Option.getOrNull(instructions);
  const beta = context.target.managed.beta;

  function matchesAgent({ agent }: AgentInput): boolean {
    if (agent.model.id !== intent.settings.model || agent.system !== system) {
      return false;
    }

    if (!isDeepStrictEqual(agent.execution_identity, DEFAULT_IDENTITY) || !isDeepStrictEqual(agent.tools, selected)) {
      return false;
    }

    return agent.mcp_servers.length === 0 && agent.skills.length === 0 && Predicate.isNull(agent.multiagent);
  }

  function matchesSession({ session }: SessionInput): boolean {
    return (
      session.resources.length === 0 &&
      isDeepStrictEqual(session.budget, budget) &&
      matchesAgent({ agent: session.agent })
    );
  }

  const saved = yield* files.receipt.read();

  if (Option.isSome(saved)) {
    const receipt = saved.value;

    if (receipt.creationRequestId !== intent.creationRequestId) {
      return yield* provisioningIssue({ reason: 'The saved receipt belongs to another role' });
    }

    const restored = yield* managedRequest({
      action: 'Verify saved eval session',
      operation: (signal) => beta.sessions.retrieve(receipt.sessionId, {}, { signal }),
    });

    const ownsReceipt =
      restored.id === receipt.sessionId &&
      restored.agent.id === receipt.agentId &&
      restored.environment_id === receipt.environmentId;

    if (!ownsReceipt || !isOwned({ resource: restored, intent }) || !matchesSession({ session: restored })) {
      return yield* provisioningIssue({
        reason: 'The saved session no longer matches the role and its frozen capabilities',
      });
    }

    return receipt;
  }

  const lookup = { include_archived: true };
  const ownership = { context, intent };
  const metadata = { eval_creation_id: intent.creationRequestId };

  const agent = yield* openRoleResource({
    ...ownership,
    kind: 'agent',
    list: (signal) => beta.agents.list(lookup, { signal }),
    create: (signal) =>
      beta.agents.create(
        { name: intent.name, model: intent.settings.model, system, tools: selected, metadata },
        { signal },
      ),
  });

  if (Predicate.isNotNull(agent.archived_at) || !matchesAgent({ agent })) {
    return yield* provisioningIssue({
      reason: 'The agent does not match the frozen model, instructions and tool allowlist',
    });
  }

  const environment = yield* openRoleResource({
    ...ownership,
    kind: 'environment',
    list: (signal) => beta.environments.list(lookup, { signal }),
    create: (signal) =>
      beta.environments.create({ name: intent.name, config: { type: 'self_hosted' }, metadata }, { signal }),
  });

  if (Predicate.isNotNull(environment.archived_at) || environment.config.type !== SELF_HOSTED) {
    return yield* provisioningIssue({ reason: 'The role environment is archived or has an unexpected configuration' });
  }

  const session = yield* openRoleResource({
    ...ownership,
    kind: 'session',
    list: (signal) => beta.sessions.list({ ...lookup, agent_id: agent.id }, { signal }),
    create: (signal) =>
      beta.sessions.create(
        {
          agent: { type: 'agent', id: agent.id, version: agent.version },
          environment_id: environment.id,
          title: intent.name,
          metadata,
          budget,
        },
        { signal },
      ),
  });

  const ready = Predicate.isNull(session.archived_at) && session.status === IDLE;

  const bindsRole =
    session.agent.id === agent.id &&
    session.agent.version === agent.version &&
    session.environment_id === environment.id;

  if (!ready || !bindsRole || !matchesSession({ session })) {
    return yield* provisioningIssue({
      reason: 'The new session does not match this role’s frozen capabilities and budget',
    });
  }

  const receipt: RoleReceipt = {
    creationRequestId: intent.creationRequestId,
    agentId: agent.id,
    environmentId: environment.id,
    sessionId: session.id,
    createdAt: DateTime.makeUnsafe(session.created_at),
    resolvedModel: session.agent.model.id,
    providerRevision: Option.none(),
  };

  yield* files.receipt.create({ record: receipt });

  return receipt;
});

export const openRole = Effect.fn('openRole')(function* (
  input: OpenRole,
): Effect.fn.Return<RoleReceipt, EvalRunFailure> {
  const startedAt = DateTime.nowUnsafe();
  const startedMillis = DateTime.toEpochMillis(startedAt);
  const deadlineMillis = DateTime.toEpochMillis(input.intent.deadlineAt);
  const remaining = deadlineMillis - startedMillis;
  const timeout = provisioningIssue({ reason: 'The original role deadline expired during provisioning' });

  if (remaining <= 0) {
    return yield* timeout;
  }

  return yield* provisionRole(input).pipe(
    Effect.timeoutOrElse({ duration: remaining, orElse: () => Effect.fail(timeout) }),
  );
});
