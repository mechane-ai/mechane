import { LocalSandboxProvider, LoopbackOrigin } from '@mechane/deployment';
import { Effect, Schema } from 'effect';
import { LocalCommand, LOOPBACK_HOST, StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import type { StackSettings } from '../types.ts';

const EPHEMERAL_PORT = '0';

type DecodeStackSettingsInput = Omit<StackSettings, 'sandboxProvider' | 'localOrigin' | 'localCommand'> & {
  readonly sandboxProvider: string;
  readonly localOrigin: string;
  readonly localCommand: string;
};

const isBareLocalOrigin: (origin: URL) => boolean = (origin) => {
  const bare = new URL(origin.origin);

  return origin.hostname === LOOPBACK_HOST && origin.port !== EPHEMERAL_PORT && origin.href === bare.href;
};

const bareLocalOrigin = Schema.makeFilter(isBareLocalOrigin, {
  expected: 'an HTTP origin on 127.0.0.1 with a nonzero port and no path, credentials, query or fragment',
});

const LocalOrigin = LoopbackOrigin.check(bareLocalOrigin);

const LocalConfiguration = Schema.Struct({
  sandboxProvider: Schema.Enum(LocalSandboxProvider),
  localOrigin: LocalOrigin,
  localCommand: Schema.Enum(LocalCommand),
});

/** Validates the command, sandbox provider, and local origin without exposing credentials. */
export const decodeStackSettings = Effect.fn('decodeStackSettings')(function* (
  input: DecodeStackSettingsInput,
): Effect.fn.Return<StackSettings, StackFailed> {
  const decoded = yield* Schema.decodeUnknownEffect(LocalConfiguration)(input).pipe(
    Effect.mapError(
      () =>
        new StackFailed({
          step: StackStep.ReadLocalSettings,
          reason:
            'use start, fixture, or reset --confirm with a valid local provider and an HTTP origin on 127.0.0.1 with a nonzero port',
        }),
    ),
  );

  return { ...input, ...decoded };
});
