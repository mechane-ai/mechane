import { LOOPBACK_HOSTS } from '@mechane/deployment';
import { KeyPurpose, WorkerMisconfigured } from '@mechane/protocol';
import { objectBindings } from '@mechane/rpc';
import type { DecodeSettingsInput } from '@mechane/rpc';
import { Duration, Effect, Option, Schema } from 'effect';
import { WorkerVariables } from '../schemas.ts';
import type { WorkerSettings } from '../types.ts';

/** Decodes the runtime's environment; it is the only code that reads a binding or a variable. */
export const decodeSettings = Effect.fn('decodeSettings')(function* ({
  environment,
}: DecodeSettingsInput): Effect.fn.Return<WorkerSettings, WorkerMisconfigured> {
  const { loginKeyLifetimeSeconds, namedKeyLifetimeSeconds, ...variables } = yield* Schema.decodeUnknownEffect(
    WorkerVariables,
  )(environment).pipe(Effect.mapError((error) => new WorkerMisconfigured({ reason: error.message })));

  if (Option.isSome(variables.localBootstrapSecret) && !LOOPBACK_HOSTS.has(variables.origin.hostname)) {
    return yield* new WorkerMisconfigured({ reason: 'local bootstrap requires a loopback origin' });
  }

  if (Option.isSome(variables.githubClientId) !== Option.isSome(variables.githubClientSecret)) {
    return yield* new WorkerMisconfigured({ reason: 'GitHub sign-in requires both its client id and secret' });
  }

  if (Option.isNone(variables.githubClientId) && Option.isNone(variables.localBootstrapSecret)) {
    return yield* new WorkerMisconfigured({ reason: 'configure GitHub sign-in or local bootstrap' });
  }

  return {
    ...variables,
    keyLifetimes: {
      [KeyPurpose.Login]: Duration.seconds(loginKeyLifetimeSeconds),
      [KeyPurpose.Named]: Duration.seconds(namedKeyLifetimeSeconds),
    },
    ...objectBindings({ environment }),
    releases: environment.RELEASES,
  };
});
