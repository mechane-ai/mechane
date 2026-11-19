import { HttpHeader } from '@mechane/records';
import { ExecutionEnvironment, installedCommandEnvironmentPath } from '@mechane/sandbox-wire';
import type { ManagedWorkerClaim } from '@mechane/sandbox-wire';
import { Effect, Option, Schema } from 'effect';
import { InstalledCommandFailed } from '../errors.ts';

type EnvironmentLookup = {
  readonly origin: string;
  readonly sessionId: ManagedWorkerClaim['sessionId'];
  readonly token: string;
  readonly transport: typeof fetch;
  readonly signal: AbortSignal;
};

export const readCommandEnvironment = Effect.fn('readCommandEnvironment')(function* ({
  origin,
  sessionId,
  token,
  transport,
  signal,
}: EnvironmentLookup): Effect.fn.Return<ExecutionEnvironment, InstalledCommandFailed> {
  const path = installedCommandEnvironmentPath({ sessionId });
  const url = new URL(path, origin);
  const headers = { [HttpHeader.Authorization]: `Bearer ${token}` };

  const response = yield* Effect.tryPromise({
    try: () => transport(url, { headers, signal, redirect: 'error', cache: 'no-store' }),
    catch: () => new InstalledCommandFailed({ reason: 'Cannot reach command access service' }),
  });

  if (!response.ok) {
    const body = Option.fromNullishOr(response.body);

    if (Option.isSome(body)) {
      yield* Effect.tryPromise({
        try: () => body.value.cancel(),
        catch: () => new InstalledCommandFailed({ reason: 'Command access was denied' }),
      });
    }

    return yield* new InstalledCommandFailed({ reason: `Command access lookup returned HTTP ${response.status}` });
  }

  const reason = 'Command access response is invalid';

  const value: unknown = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: () => new InstalledCommandFailed({ reason }),
  });

  const decoded = Schema.decodeUnknownEffect(ExecutionEnvironment)(value);

  return yield* Effect.mapError(decoded, () => new InstalledCommandFailed({ reason }));
});
