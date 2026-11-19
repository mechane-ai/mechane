import type { BetaManagedAgentsSessionEvent } from '@anthropic-ai/sdk/resources/beta/sessions/events';
import { CreationRequestId } from '@mechane/records';
import { DateTime, Effect, Option, Schema } from 'effect';
import { isDeepStrictEqual } from 'node:util';
import { EvalCallId } from '../application-schemas.ts';
import type { RoleIntent, RoleReceipt, RoleRecord } from '../application-schemas.ts';
import type { RunRoleInput } from '../application-types.ts';
import { executeObservedTool } from '../environment/execute-observed-tool.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from '../errors.ts';
import { managedRequest } from '../managed-request.ts';
import type { EvalRunFailure } from '../types.ts';
import { openRole } from './open-role.ts';
import { readRoleRecord } from './read-role-record.ts';
import { roleEvents, terminalReason } from './role-events.ts';
import { selectRoleFiles } from './role-files.ts';

type ActiveRole = RunRoleInput & { readonly receipt: RoleReceipt; readonly intent: RoleIntent };
const POLL_INTERVAL = '250 millis';

const EventType = {
  UserMessage: 'user.message',
  Result: 'user.custom_tool_result',
  ToolUse: 'agent.custom_tool_use',
} as const;

type RoleIssueInput = { readonly reason: string };

function roleIssue({ reason }: RoleIssueInput): EvalAdapterFailed {
  return new EvalAdapterFailed({ operation: EvalAdapterOperation.ManagedRequest, reason });
}

const admitEvalInput = Effect.fn('admitEvalInput')(function* ({
  context,
  role,
  intent,
  receipt,
}: ActiveRole): Effect.fn.Return<void, EvalRunFailure> {
  const files = selectRoleFiles({ context, role });
  const marked = yield* files.inputAttempt.read();
  const history = yield* roleEvents({ context, sessionId: receipt.sessionId });
  const messages = history.filter((event) => event.type === EventType.UserMessage);
  const [accepted] = messages;
  const message = Option.fromUndefinedOr(accepted);
  const attempt = { sessionId: receipt.sessionId, creationRequestId: intent.creationRequestId };

  if (Option.isSome(message)) {
    const expected = [{ type: 'text', text: intent.text }];
    const sentHere = Option.exists(marked, (record) => isDeepStrictEqual(record, attempt));
    const sameInput = messages.length === 1 && isDeepStrictEqual(message.value.content, expected);

    if (!sentHere || !sameInput) {
      return yield* roleIssue({ reason: 'The accepted input does not match this isolated role and its recorded send' });
    }

    return;
  }

  if (Option.isSome(marked)) {
    return yield* roleIssue({ reason: 'The original input send is unconfirmed. Inspect the session before retrying' });
  }

  yield* files.inputAttempt.create({ record: attempt });
  yield* managedRequest({
    action: 'send eval input',
    operation: (signal) =>
      context.target.managed.beta.sessions.events.send(
        receipt.sessionId,
        { events: [{ type: 'user.message', content: [{ type: 'text', text: intent.text }] }] },
        { signal },
      ),
  });
});

const deliverEvalTools = Effect.fn('deliverEvalTools')(function* (
  { context, role, receipt, tools, environment }: ActiveRole,
  events: ReadonlyArray<BetaManagedAgentsSessionEvent>,
): Effect.fn.Return<void, EvalRunFailure> {
  const resultEvents = events.filter((event) => event.type === EventType.Result);
  const resultIds = resultEvents.map((event) => event.custom_tool_use_id);
  const results = new Set(resultIds);
  const calls = events.filter((event) => event.type === EventType.ToolUse).filter((event) => !results.has(event.id));

  for (const event of calls) {
    if (Option.isNone(environment)) {
      return yield* roleIssue({ reason: 'The role requested a tool without a fixture' });
    }

    const args = yield* Schema.decodeUnknownEffect(Schema.Json)(event.input).pipe(
      Effect.mapError((error) => roleIssue({ reason: error.message })),
    );

    const callId = EvalCallId.make(event.id);

    const result = yield* executeObservedTool({
      context,
      role,
      environment: environment.value,
      tools,
      request: { callId, name: event.name, arguments: args },
    });

    const output = JSON.stringify(result.output);

    yield* managedRequest({
      action: 'return eval tool result',
      operation: (signal) =>
        context.target.managed.beta.sessions.events.send(
          receipt.sessionId,
          {
            events: [
              {
                type: 'user.custom_tool_result',
                custom_tool_use_id: event.id,
                is_error: result.isError,
                content: [{ type: 'text', text: output }],
              },
            ],
          },
          { signal },
        ),
    });
  }
});

export const runRole = Effect.fn('runRole')(function* (
  input: RunRoleInput,
): Effect.fn.Return<RoleRecord, EvalRunFailure> {
  const { context, role, settings, text, tools } = input;
  const files = selectRoleFiles({ context, role });
  const saved = yield* files.record.read();

  if (Option.isSome(saved)) {
    return saved.value;
  }

  const previous = yield* files.intent.read();

  const intent: RoleIntent = Option.getOrElse(previous, () => {
    const now = DateTime.nowUnsafe();

    return {
      creationRequestId: CreationRequestId.make(crypto.randomUUID()),
      name: `${role} ${context.trialId}`,
      role,
      settings,
      text,
      deadlineAt: DateTime.addDuration(now, context.bounds.roleTimeout),
      capMicros: context.bounds.roleCapMicros,
    };
  });

  if (Option.isNone(previous)) {
    yield* files.intent.create({ record: intent });
  }

  const deadline = DateTime.toEpochMillis(intent.deadlineAt);
  const started = DateTime.nowUnsafe();

  if (deadline <= DateTime.toEpochMillis(started)) {
    const existing = yield* files.receipt.read();

    if (Option.isNone(existing)) {
      return yield* roleIssue({ reason: 'The role deadline expired before a session receipt was recorded' });
    }

    const record = yield* readRoleRecord({
      context,
      intent,
      receipt: existing.value,
      reason: 'The original role deadline was exceeded',
    });

    yield* files.record.create({ record });

    return record;
  }

  const receipt = yield* openRole({ context, role, intent, tools });
  const active = { ...input, intent, receipt };
  const ready = DateTime.nowUnsafe();
  const remaining = deadline - DateTime.toEpochMillis(ready);

  const expiredEvalRole = Effect.fn('expiredEvalRole')(function* (): Effect.fn.Return<RoleRecord, EvalRunFailure> {
    return yield* readRoleRecord({ ...active, reason: 'The original role deadline was exceeded' });
  });

  const finishEvalRole = Effect.fn('finishEvalRole')(function* (): Effect.fn.Return<RoleRecord, EvalRunFailure> {
    if (remaining <= 0) {
      return yield* expiredEvalRole();
    }

    yield* admitEvalInput(active);

    let history = yield* roleEvents({ context, sessionId: receipt.sessionId });
    let terminal = terminalReason({ events: history });

    while (Option.isNone(terminal)) {
      yield* deliverEvalTools(active, history);
      yield* Effect.sleep(POLL_INTERVAL);

      history = yield* roleEvents({ context, sessionId: receipt.sessionId });
      terminal = terminalReason({ events: history });
    }

    return yield* readRoleRecord({ ...active, events: history });
  });

  const run = finishEvalRole();
  const duration = Math.max(0, remaining);
  const record = yield* run.pipe(Effect.timeoutOrElse({ duration, orElse: expiredEvalRole }));

  yield* files.record.create({ record });

  return record;
});
