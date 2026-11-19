import type {
  BetaManagedAgentsAgentCustomToolUseEvent,
  BetaManagedAgentsSessionEvent,
} from '@anthropic-ai/sdk/resources/beta/sessions/events';
import type { BetaManagedAgentsSessionUsage } from '@anthropic-ai/sdk/resources/beta/sessions/sessions';
import { Array, DateTime, Effect, Option, Schema } from 'effect';
import { EvalRoleStatus, MinorUnits } from '../application-schemas.ts';
import type { Observation, RoleIntent, RoleReceipt, RoleRecord } from '../application-schemas.ts';
import type { Json, RoleContext } from '../application-types.ts';
import { EvalRole } from '../constants.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from '../errors.ts';
import { managedRequest } from '../managed-request.ts';
import type { EvalRunFailure } from '../types.ts';
import { roleEvents, terminalReason } from './role-events.ts';

type RoleIdentity = { readonly context: RoleContext; readonly intent: RoleIntent; readonly receipt: RoleReceipt };
type CollectedEvents = { readonly events: ReadonlyArray<BetaManagedAgentsSessionEvent> };
type InterruptedRole = { readonly reason: string };
type ReadRoleRecord = RoleIdentity & (CollectedEvents | InterruptedRole);

type UsageInput = {
  readonly current: BetaManagedAgentsSessionUsage;
  readonly history: ReadonlyArray<BetaManagedAgentsSessionEvent>;
};

const EVENT = {
  Usage: 'session.usage',
  Tool: 'agent.custom_tool_use',
  Message: 'agent.message',
  Text: 'text',
} as const;

const STOP = { End: 'end_turn', Refusal: 'refusal', Interrupted: 'interrupted' } as const;
const CURRENCY = 'USD';

const UsdPrice = Schema.Struct({ currency: Schema.Literal(CURRENCY), amount: MinorUnits });

function sessionUsage({ current, history }: UsageInput): NonNullable<RoleRecord['usage']> {
  const snapshot = Array.findLast(history, (event) => event.type === EVENT.Usage);

  const previous: BetaManagedAgentsSessionUsage = Option.match(snapshot, {
    onSome: (event) => event.usage,
    onNone: () => ({}),
  });

  const usage = { ...previous, ...current };
  const cache = { ...previous.cache_creation, ...current.cache_creation };
  const price = usage.list_cost;

  return {
    ...('input_tokens' in usage && { inputTokens: usage.input_tokens }),
    ...('output_tokens' in usage && { outputTokens: usage.output_tokens }),
    ...('cache_read_input_tokens' in usage && { cacheReadInputTokens: usage.cache_read_input_tokens }),
    ...('ephemeral_1h_input_tokens' in cache && { cacheCreation1hInputTokens: cache.ephemeral_1h_input_tokens }),
    ...('ephemeral_5m_input_tokens' in cache && { cacheCreation5mInputTokens: cache.ephemeral_5m_input_tokens }),
    ...(Schema.is(UsdPrice)(price) && { listCostUsdCents: price.amount }),
  };
}

type CompletionInput = {
  readonly stop: Option.Option<string>;
  readonly status: string;
  readonly cancellation: Option.Option<string>;
};

function roleCompletion({ stop, status, cancellation }: CompletionInput): Pick<RoleRecord, 'status' | 'issue'> {
  if (Option.isSome(cancellation)) {
    return { status: EvalRoleStatus.Cancelled, issue: cancellation.value };
  }

  const stopped = Option.getOrElse(stop, () => status);

  switch (stopped) {
    case STOP.End:
    case STOP.Refusal:
      return { status: EvalRoleStatus.Completed };
    case STOP.Interrupted:
      return { status: EvalRoleStatus.Cancelled, issue: 'Session interrupted' };
    default:
      return { status: EvalRoleStatus.Failed, issue: `Session stopped: ${stopped}` };
  }
}

export const readRoleRecord = Effect.fn('readRoleRecord')(function* (
  input: ReadRoleRecord,
): Effect.fn.Return<RoleRecord, EvalRunFailure> {
  const { context, intent, receipt } = input;
  let history: ReadonlyArray<BetaManagedAgentsSessionEvent> = [];

  if ('events' in input) {
    history = input.events;
  } else {
    history = yield* roleEvents({ context, sessionId: receipt.sessionId });
  }

  const session = yield* managedRequest({
    action: 'read eval session',
    operation: (signal) => context.target.managed.beta.sessions.retrieve(receipt.sessionId, {}, { signal }),
  });

  const sessionMatchesReceipt =
    session.id === receipt.sessionId &&
    session.agent.id === receipt.agentId &&
    session.environment_id === receipt.environmentId;

  if (!sessionMatchesReceipt || intent.creationRequestId !== receipt.creationRequestId) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.VerifyRoleSettings,
      reason: 'The returned eval session does not match the saved role intent and receipt',
    });
  }

  const readObservations = Effect.fn('readObservations')(function* (): Effect.fn.Return<
    ReadonlyArray<Observation>,
    EvalRunFailure
  > {
    if (intent.role === EvalRole.Subject) {
      return yield* context.files.readObservations();
    }

    return yield* context.files.readJudgeObservations();
  });

  const observations = yield* readObservations();
  const callIds = observations.map((entry) => entry.callId);
  const observed = new Set<string>(callIds);
  const calls = history.filter((event) => event.type === EVENT.Tool);
  const unknowns = calls.filter((call) => !observed.has(call.id)).map((call) => `Missing observation for ${call.id}`);
  const stop = terminalReason({ events: history });
  let cancellation = Option.none<string>();

  if ('reason' in input) {
    cancellation = Option.some(input.reason);
  }

  const completion = roleCompletion({ stop, status: session.status, cancellation });

  const reply = history
    .filter((event) => event.type === EVENT.Message)
    .flatMap((event) => event.content.filter((block) => block.type === EVENT.Text).map((block) => block.text))
    .filter((text) => text.length > 0)
    .join('\n\n');

  const toolCalls = yield* Effect.forEach(calls, (call) => recordTool(call), { concurrency: 1 });

  return {
    ...completion,
    agentId: receipt.agentId,
    sessionId: receipt.sessionId,
    eventIds: history.map((event) => event.id),
    requestedModel: Option.some(intent.settings.model),
    resolvedModel: receipt.resolvedModel,
    providerRevision: receipt.providerRevision,
    usage: sessionUsage({ current: session.usage, history }),
    toolCalls,
    isEvidenceComplete: completion.status === EvalRoleStatus.Completed && unknowns.length === 0,
    unknowns,
    endedAt: DateTime.nowUnsafe(),
    ...(reply.length > 0 && { reply }),
  };
});

const recordTool = Effect.fn('recordTool')(function* ({
  type,
  id,
  name,
  input,
}: BetaManagedAgentsAgentCustomToolUseEvent): Effect.fn.Return<Json, EvalAdapterFailed> {
  const args = yield* Schema.decodeUnknownEffect(Schema.Json)(input).pipe(
    Effect.mapError(
      (error) => new EvalAdapterFailed({ operation: EvalAdapterOperation.ExecuteTool, reason: error.message }),
    ),
  );

  return { type, id, name, input: args };
});
