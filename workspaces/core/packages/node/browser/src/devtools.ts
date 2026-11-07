import { BYTES_PER_MEBIBYTE } from '@mechane/records';
import { Duration, Effect, Option, Result, Schema } from 'effect';
import { ProtocolMessage } from './devtools.schemas.ts';
import type { DevtoolsSessionId } from './devtools.schemas.ts';
import { BrowserFailed, BrowserFailureKind, BrowserUncertain } from './errors.ts';

const COMMAND_TIMEOUT = Duration.seconds(15);
const PROTOCOL_MAX_CHARS = 96 * BYTES_PER_MEBIBYTE;

type ProtocolEvent = { readonly method: string; readonly params: unknown; readonly sessionId: DevtoolsSessionId };

type ProtocolCall = {
  readonly method: string;
  readonly params: Readonly<Record<string, unknown>>;
  /** Absent for browser-level commands rather than commands addressed to an attached page. */
  readonly sessionId: Option.Option<DevtoolsSessionId>;
};

type ObserveProtocolInput = { readonly listener: (event: ProtocolEvent) => void };
type FailConnectionInput = { readonly failure: BrowserFailed };

type PendingReply = {
  readonly method: string;
  readonly resume: (response: Effect.Effect<unknown, BrowserFailed | BrowserUncertain>) => void;
};

/** Separates known command rejection from a lost acknowledgement after a command may have executed. */
export type DevtoolsConnection = {
  readonly call: (input: ProtocolCall) => Effect.Effect<unknown, BrowserFailed | BrowserUncertain>;
  readonly observe: (input: ObserveProtocolInput) => void;
  readonly close: () => void;
};

type ConnectDevtoolsInput = { readonly websocketUrl: string };

/** Opens the private Chromium websocket and bounds pending command acknowledgements. */
export const connectDevtools = Effect.fn('connectDevtools')(function* ({
  websocketUrl,
}: ConnectDevtoolsInput): Effect.fn.Return<DevtoolsConnection, BrowserFailed> {
  const socket = new WebSocket(websocketUrl);
  const pending = new Map<number, PendingReply>();
  const listeners = new Set<(event: ProtocolEvent) => void>();
  const state = { sequence: 0, failure: Option.none<BrowserFailed>() };
  const messageSchema = Schema.fromJsonString(ProtocolMessage);
  const decodeMessage = Schema.decodeUnknownResult(messageSchema, { onExcessProperty: 'error' });

  const fail: (input: FailConnectionInput) => void = ({ failure }) => {
    state.failure = Option.some(failure);

    for (const reply of pending.values()) {
      const uncertain = new BrowserUncertain({
        kind: BrowserFailureKind.Transport,
        reason: `Chromium command ${reply.method} lost its acknowledgement: ${failure.reason}`,
      });

      const rejected = Result.fail(uncertain);
      const failed = Effect.fromResult(rejected);

      reply.resume(failed);
    }

    pending.clear();
  };

  const receive: (event: MessageEvent) => void = (event) => {
    const text: unknown = event.data;

    if (typeof text !== 'string' || text.length > PROTOCOL_MAX_CHARS) {
      const failure = new BrowserFailed({
        kind: BrowserFailureKind.Protocol,
        reason: 'Chromium sent an oversized or non-text protocol message',
      });

      fail({ failure });
      socket.close();

      return;
    }

    const decoded = decodeMessage(text);

    if (Result.isFailure(decoded)) {
      const failure = new BrowserFailed({
        kind: BrowserFailureKind.Protocol,
        reason: 'Chromium sent an invalid protocol message',
      });

      fail({ failure });
      socket.close();

      return;
    }

    const message = decoded.success;

    const identity = Option.fromNullishOr(message.id);

    if (Option.isSome(identity)) {
      const reply = pending.get(identity.value);
      const waiting = Option.fromNullishOr(reply);

      pending.delete(identity.value);

      if (Option.isNone(waiting)) {
        return;
      }

      const error = Option.fromNullishOr(message.error);

      if (Option.isSome(error)) {
        const failure = new BrowserFailed({ kind: BrowserFailureKind.Protocol, reason: error.value.message });
        const rejected = Result.fail(failure);
        const response = Effect.fromResult(rejected);

        waiting.value.resume(response);

        return;
      }

      const succeeded = Result.succeed(message.result);
      const response = Effect.fromResult(succeeded);

      waiting.value.resume(response);

      return;
    }

    const method = Option.fromNullishOr(message.method);
    const sessionId = Option.fromNullishOr(message.sessionId);

    if (Option.isNone(method) || Option.isNone(sessionId)) {
      return;
    }

    for (const listener of listeners) {
      listener({ method: method.value, params: message.params, sessionId: sessionId.value });
    }
  };

  socket.addEventListener('message', receive);
  socket.addEventListener('close', () => {
    const failure = new BrowserFailed({
      kind: BrowserFailureKind.Transport,
      reason: 'Chromium protocol connection closed',
    });

    fail({ failure });
  });
  socket.addEventListener('error', () => {
    const failure = new BrowserFailed({
      kind: BrowserFailureKind.Transport,
      reason: 'Chromium protocol connection failed',
    });

    fail({ failure });
  });

  const opened = Effect.callback<void, BrowserFailed>((resume) => {
    socket.addEventListener('open', () => resume(Effect.void), { once: true });
    socket.addEventListener(
      'error',
      () => {
        const failure = new BrowserFailed({
          kind: BrowserFailureKind.Transport,
          reason: 'Chromium protocol connection could not open',
        });

        const rejected = Result.fail(failure);
        const failed = Effect.fromResult(rejected);

        resume(failed);
      },
      { once: true },
    );

    return Effect.sync(() => {
      if (socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    });
  });

  yield* opened.pipe(
    Effect.timeoutOrElse({
      duration: COMMAND_TIMEOUT,
      orElse: () => {
        const failure = new BrowserFailed({
          kind: BrowserFailureKind.Transport,
          reason: 'Chromium protocol connection timed out',
        });

        return Effect.fail(failure);
      },
    }),
  );

  const call = Effect.fn('call')(function* ({
    method,
    params,
    sessionId,
  }: ProtocolCall): Effect.fn.Return<unknown, BrowserFailed | BrowserUncertain> {
    if (Option.isSome(state.failure)) {
      return yield* state.failure.value;
    }

    if (socket.readyState !== WebSocket.OPEN) {
      return yield* new BrowserFailed({
        kind: BrowserFailureKind.Transport,
        reason: `Chromium command ${method} was not sent because its socket is closed`,
      });
    }

    const response = Effect.callback<unknown, BrowserFailed | BrowserUncertain>((resume) => {
      state.sequence += 1;
      const sequence = state.sequence;
      const targetSession = Option.getOrUndefined(sessionId);
      const payload = JSON.stringify({ id: sequence, method, params, sessionId: targetSession });

      pending.set(sequence, { method, resume });

      const sent = Result.try(() => socket.send(payload));

      if (Result.isFailure(sent)) {
        const failure = new BrowserUncertain({
          kind: BrowserFailureKind.Transport,
          reason: `Chromium command ${method} failed while sending; its outcome is uncertain`,
        });

        const rejected = Result.fail(failure);
        const failed = Effect.fromResult(rejected);

        pending.delete(sequence);
        resume(failed);
      }

      return Effect.sync(() => pending.delete(sequence));
    });

    return yield* response.pipe(
      Effect.timeoutOrElse({
        duration: COMMAND_TIMEOUT,
        orElse: () => {
          const failure = new BrowserUncertain({
            kind: BrowserFailureKind.Transport,
            reason: `Chromium command ${method} timed out; its outcome is uncertain`,
          });

          return Effect.fail(failure);
        },
      }),
    );
  });

  const observe: DevtoolsConnection['observe'] = ({ listener }) => {
    listeners.add(listener);
  };

  const close: DevtoolsConnection['close'] = () => socket.close();

  return { call, observe, close };
});

type DevtoolsCommandInput<S extends Schema.Codec<unknown, unknown>> = ProtocolCall & {
  readonly connection: DevtoolsConnection;
  readonly schema: S;
};

/** Decodes a command’s foreign reply; an invalid acknowledged reply remains an uncertain outcome. */
export const devtoolsCommand = Effect.fn('devtoolsCommand')(function* <S extends Schema.Codec<unknown, unknown>>({
  connection,
  schema,
  ...command
}: DevtoolsCommandInput<S>): Effect.fn.Return<S['Type'], BrowserFailed | BrowserUncertain, S['DecodingServices']> {
  const response = yield* connection.call(command);

  return yield* Schema.decodeUnknownEffect(schema, { onExcessProperty: 'error' })(response).pipe(
    Effect.mapError(
      () =>
        new BrowserUncertain({
          kind: BrowserFailureKind.Protocol,
          reason: `Chromium command ${command.method} returned an invalid response; its outcome is uncertain`,
        }),
    ),
  );
});
