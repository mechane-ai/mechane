import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { SavedLoginMissing } from '@mechane/cli-kernel';
import { writeDiagnostic } from '@mechane/program';
import { ConsoleMessageId, WakeId } from '@mechane/protocol';
import { DateTime, Effect, Option } from 'effect';
import type { Redacted } from 'effect';

type SelfCredentialInput = { readonly credentials: RunInput<'self message'>['credentials']; readonly origin: URL };

const selfCredential = Effect.fn('selfCredential')(function* ({
  credentials,
  origin,
}: SelfCredentialInput): Effect.fn.Return<Redacted.Redacted, SavedLoginMissing> {
  const token = credentials.selfToken;

  if (Option.isNone(token)) {
    const savedOrigin = Option.none();

    return yield* new SavedLoginMissing({ origin: origin.origin, savedOrigin });
  }

  return token.value;
});

export const runSelfWakeSchedule = Effect.fn('runSelfWakeSchedule')(function* ({
  call,
  input,
  credentials,
  origin,
}: RunInput<'self wake schedule'>): Effect.fn.Return<CommandResult<'self wake schedule'>, RunFailure> {
  const requestedWakeId = Option.fromNullishOr(input.wakeId);
  const wakeId = Option.getOrElse(requestedWakeId, () => WakeId.make(crypto.randomUUID()));
  const credential = yield* selfCredential({ credentials, origin });

  writeDiagnostic({
    program: 'mechane',
    line: `scheduling wake ${wakeId}; retry the same intent with --wake-id ${wakeId}`,
  });

  const wake = yield* call({ name: 'scheduleSelfWake', input: { ...input, wakeId }, credential });

  return { result: wake, lines: [`${wake.id} ${wake.status} for ${DateTime.formatIso(wake.dueAt)}`] };
});

export const runSelfWakeShow = Effect.fn('runSelfWakeShow')(function* ({
  call,
  input,
  credentials,
  origin,
}: RunInput<'self wake show'>): Effect.fn.Return<CommandResult<'self wake show'>, RunFailure> {
  const credential = yield* selfCredential({ credentials, origin });
  const wake = yield* call({ name: 'showSelfWake', input, credential });

  return { result: wake, lines: [`${wake.id} ${wake.status} for ${DateTime.formatIso(wake.dueAt)}`] };
});

export const runSelfWakeList = Effect.fn('runSelfWakeList')(function* ({
  call,
  input,
  credentials,
  origin,
}: RunInput<'self wake list'>): Effect.fn.Return<CommandResult<'self wake list'>, RunFailure> {
  const credential = yield* selfCredential({ credentials, origin });
  const result = yield* call({ name: 'listSelfWakes', input, credential });
  const lines = result.wakes.map((wake) => `${wake.id} ${wake.status} for ${DateTime.formatIso(wake.dueAt)}`);

  if (Option.isSome(result.nextAfter)) {
    return { result, lines: [...lines, `more wakes follow; continue with --after ${result.nextAfter.value}`] };
  }

  return { result, lines };
});

export const runSelfWakeCancel = Effect.fn('runSelfWakeCancel')(function* ({
  call,
  input,
  credentials,
  origin,
}: RunInput<'self wake cancel'>): Effect.fn.Return<CommandResult<'self wake cancel'>, RunFailure> {
  const credential = yield* selfCredential({ credentials, origin });
  const wake = yield* call({ name: 'cancelSelfWake', input, credential });

  return { result: wake, lines: [`${wake.id} ${wake.status}`] };
});

export const runSelfMessage = Effect.fn('runSelfMessage')(function* ({
  call,
  input,
  credentials,
  origin,
}: RunInput<'self message'>): Effect.fn.Return<CommandResult<'self message'>, RunFailure> {
  const credential = yield* selfCredential({ credentials, origin });
  const requestedMessageId = Option.fromNullishOr(input.messageId);
  const messageId = Option.getOrElse(requestedMessageId, () => ConsoleMessageId.make(crypto.randomUUID()));

  writeDiagnostic({
    program: 'mechane',
    line: `publishing message ${messageId}; retry the same text with --message-id ${messageId}`,
  });

  const message = yield* call({ name: 'publishSelfMessage', input: { ...input, messageId }, credential });

  return { result: message, lines: [`${message.id} published at ${DateTime.formatIso(message.createdAt)}`] };
});
