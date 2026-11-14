import { SecureOrigin } from '@mechane/deployment';
import { Array, Duration, Effect, Exit, Option, Result, Schema } from 'effect';
import type { Scope } from 'effect';
import { spawn } from 'node:child_process';
import type { ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import type { EvalTransport, EvalTransportInput, OpenEvalTransport } from '../application-types.ts';
import { EvalTransportFailed } from '../errors.ts';

type CreateCloudflaredTransportInput = { readonly executable: string };
type StartTunnelInput = { readonly executable: string; readonly localOrigin: URL };
type TunnelState = { readonly isClosed: boolean; readonly failure: Option.Option<EvalTransportFailed> };
type TunnelProcess = { readonly child: ChildProcessByStdio<null, null, Readable>; readonly state: TunnelState };
type TunnelProcessInput = { readonly process: TunnelProcess };
type SignalTunnelInput = TunnelProcessInput & { readonly signal: NodeJS.Signals };
type WaitForCloseInput = TunnelProcessInput & { readonly timeout: Duration.Duration };
type ProbeHealthInput = { readonly origin: URL; readonly signal: AbortSignal };
type AwaitHealthInput = TunnelProcessInput & { readonly origin: URL };

const ANNOUNCEMENT_TIMEOUT = Duration.seconds(30);
const ANNOUNCEMENT_MAX_CHARS = 16_000;
const ROUTE_SETTLE = Duration.seconds(5);
const HEALTH_ATTEMPTS = 40;
const HEALTH_REQUEST_TIMEOUT = Duration.seconds(3);
const HEALTH_RETRY_DELAY = Duration.seconds(1);
const TERMINATE_TIMEOUT = Duration.seconds(3);
const KILL_TIMEOUT = Duration.seconds(3);
const HEALTH_MAX_CHARS = 4096;
const TUNNEL_ORIGIN_PATTERN = /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/u;
const EVAL_SERVICE = 'mechane-eval';
const TunnelHealth = Schema.fromJsonString(Schema.Struct({ service: Schema.Literal(EVAL_SERVICE) }));

const TunnelOperation = {
  Start: 'start cloudflared',
  Open: 'open cloudflared',
  ReadOrigin: 'read cloudflared origin',
  Probe: 'probe cloudflared',
  Close: 'close cloudflared',
} as const;

/** Opens a scoped Cloudflare tunnel and confirms the eval listener is reachable before returning. */
export function createCloudflaredTransport({ executable }: CreateCloudflaredTransportInput): OpenEvalTransport {
  return Effect.fn('openCloudflaredTransport')(function* ({
    localOrigin,
  }: EvalTransportInput): Effect.fn.Return<EvalTransport, EvalTransportFailed, Scope.Scope> {
    const starting = startTunnel({ executable, localOrigin });

    const process = yield* Effect.acquireRelease(starting, (tunnel) =>
      releaseTunnel({ process: tunnel }).pipe(Effect.orDie),
    );

    const origin = yield* readTunnelOrigin({ process });

    yield* awaitTunnelHealth({ process, origin });

    return { origin, release: releaseTunnel({ process }) };
  });
}

const startTunnel = Effect.fn('startTunnel')(function* ({
  executable,
  localOrigin,
}: StartTunnelInput): Effect.fn.Return<TunnelProcess, EvalTransportFailed> {
  const child = yield* Effect.try({
    try: () =>
      spawn(executable, ['tunnel', '--url', localOrigin.origin, '--no-autoupdate'], {
        stdio: ['ignore', 'ignore', 'pipe'],
      }),
    catch: () =>
      new EvalTransportFailed({
        operation: TunnelOperation.Start,
        reason: 'The configured executable could not start',
      }),
  });

  const state = { isClosed: false, failure: Option.none<EvalTransportFailed>() };

  child.once('error', () => {
    const failure = new EvalTransportFailed({
      operation: TunnelOperation.Start,
      reason: 'Install the pinned cloudflared executable before opening the hosted eval transport',
    });

    state.failure = Option.some(failure);
  });
  child.once('close', () => {
    state.isClosed = true;
  });

  return { child, state };
});

const readTunnelOrigin = Effect.fn('readTunnelOrigin')(function* ({
  process,
}: TunnelProcessInput): Effect.fn.Return<URL, EvalTransportFailed> {
  if (Option.isSome(process.state.failure)) {
    return yield* process.state.failure.value;
  }

  if (process.state.isClosed) {
    return yield* new EvalTransportFailed({
      operation: TunnelOperation.Open,
      reason: 'The tunnel exited before it became ready',
    });
  }

  return yield* Effect.callback<URL, EvalTransportFailed>((resume) => {
    const output = { text: '' };

    function onError(): void {
      const failure = new EvalTransportFailed({
        operation: TunnelOperation.Open,
        reason: 'The tunnel executable failed to start',
      });

      const failed = Exit.fail(failure);

      resume(failed);
    }

    function onClose(): void {
      const failure = new EvalTransportFailed({
        operation: TunnelOperation.Open,
        reason: 'The tunnel exited before it became ready',
      });

      const failed = Exit.fail(failure);

      resume(failed);
    }

    const onOutput: (chunk: Buffer) => void = (chunk) => {
      output.text = (output.text + chunk.toString()).slice(-ANNOUNCEMENT_MAX_CHARS);
      const found = TUNNEL_ORIGIN_PATTERN.exec(output.text);
      const match = Option.fromNullishOr(found);

      if (Option.isNone(match) || !output.text.includes('Registered tunnel connection')) {
        return;
      }

      const decoded = Schema.decodeUnknownResult(SecureOrigin)(match.value[0]);

      if (Result.isFailure(decoded)) {
        const failure = new EvalTransportFailed({
          operation: TunnelOperation.ReadOrigin,
          reason: 'The tunnel announced an invalid public origin',
        });

        const failed = Exit.fail(failure);

        resume(failed);

        return;
      }

      const ready = Exit.succeed(decoded.success);

      resume(ready);
    };

    const timeoutMs = Duration.toMillis(ANNOUNCEMENT_TIMEOUT);

    const timer = setTimeout(() => {
      const failure = new EvalTransportFailed({
        operation: TunnelOperation.Open,
        reason: 'The tunnel did not register before its startup deadline',
      });

      const failed = Exit.fail(failure);

      resume(failed);
    }, timeoutMs);

    process.child.stderr.on('data', onOutput);
    process.child.once('error', onError);
    process.child.once('close', onClose);

    return Effect.sync(() => {
      clearTimeout(timer);
      process.child.stderr.off('data', onOutput);
      process.child.stderr.resume();
      process.child.off('error', onError);
      process.child.off('close', onClose);
    });
  });
});

const awaitTunnelHealth = Effect.fn('awaitTunnelHealth')(function* ({
  process,
  origin,
}: AwaitHealthInput): Effect.fn.Return<void, EvalTransportFailed> {
  // Cloudflared announces its hostname before its public route and DNS are usable.
  yield* Effect.sleep(ROUTE_SETTLE);

  const last = { reason: 'The health endpoint returned no valid service marker' };

  const attempts = Array.range(1, HEALTH_ATTEMPTS);

  for (const attempt of attempts) {
    if (process.state.isClosed) {
      return yield* new EvalTransportFailed({
        operation: TunnelOperation.Probe,
        reason: 'The tunnel exited while its route was becoming ready',
      });
    }

    const reason = yield* Effect.tryPromise({
      try: (signal) => probeTunnelHealth({ origin, signal }),
      catch: () =>
        new EvalTransportFailed({
          operation: TunnelOperation.Probe,
          reason: 'The public health request failed or reached its deadline',
        }),
    }).pipe(
      Effect.catchTags({
        EvalTransportFailed: (failure) => {
          const failedReason = Option.some(failure.reason);

          return Effect.succeed(failedReason);
        },
      }),
    );

    if (Option.isNone(reason)) {
      return;
    }

    last.reason = reason.value;

    if (attempt < HEALTH_ATTEMPTS) {
      yield* Effect.sleep(HEALTH_RETRY_DELAY);
    }
  }

  return yield* new EvalTransportFailed({ operation: TunnelOperation.Probe, reason: last.reason });
});

async function probeTunnelHealth({ origin, signal }: ProbeHealthInput): Promise<Option.Option<string>> {
  const url = new URL('/health', origin);
  const timeoutMs = Duration.toMillis(HEALTH_REQUEST_TIMEOUT);
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const requestSignal = AbortSignal.any([signal, timeoutSignal]);
  const response = await fetch(url, { signal: requestSignal, redirect: 'error' });

  if (!response.ok) {
    const body = Option.fromNullishOr(response.body);

    if (Option.isSome(body)) {
      await body.value.cancel();
    }

    return Option.some(`The public health endpoint returned HTTP ${response.status}`);
  }

  const text = await response.text();
  const decoded = Schema.decodeUnknownResult(TunnelHealth)(text);

  if (text.length > HEALTH_MAX_CHARS || Result.isFailure(decoded)) {
    return Option.some('The public health endpoint returned no valid service marker');
  }

  return Option.none();
}

const releaseTunnel = Effect.fn('releaseTunnel')(function* ({
  process,
}: TunnelProcessInput): Effect.fn.Return<void, EvalTransportFailed> {
  if (process.state.isClosed) {
    return;
  }

  yield* signalTunnel({ process, signal: 'SIGTERM' });

  const terminated = yield* waitForTunnelClose({ process, timeout: TERMINATE_TIMEOUT });

  if (terminated) {
    return;
  }

  yield* signalTunnel({ process, signal: 'SIGKILL' });

  const killed = yield* waitForTunnelClose({ process, timeout: KILL_TIMEOUT });

  if (!killed) {
    return yield* new EvalTransportFailed({
      operation: TunnelOperation.Close,
      reason: `Tunnel process ${process.child.pid} did not confirm exit before its cleanup deadline`,
    });
  }
});

const signalTunnel = Effect.fn('signalTunnel')(function* ({
  process,
  signal,
}: SignalTunnelInput): Effect.fn.Return<void, EvalTransportFailed> {
  yield* Effect.try({
    try: () => process.child.kill(signal),
    catch: () =>
      new EvalTransportFailed({
        operation: TunnelOperation.Close,
        reason: `Tunnel process ${process.child.pid} could not receive ${signal}`,
      }),
  });
});

const waitForTunnelClose = Effect.fn('waitForTunnelClose')(function* ({
  process,
  timeout,
}: WaitForCloseInput): Effect.fn.Return<boolean> {
  if (process.state.isClosed) {
    return true;
  }

  return yield* Effect.callback<boolean>((resume) => {
    function onClose(): void {
      const closed = Exit.succeed(true);

      resume(closed);
    }

    const timeoutMs = Duration.toMillis(timeout);

    const timer = setTimeout(() => {
      const timedOut = Exit.succeed(false);

      resume(timedOut);
    }, timeoutMs);

    process.child.once('close', onClose);

    return Effect.sync(() => {
      clearTimeout(timer);
      process.child.off('close', onClose);
    });
  });
});
