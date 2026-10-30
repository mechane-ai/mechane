import { LOOPBACK_HOSTS } from '@mechane/deployment';
import { WorkerMisconfigured } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import type { WorkerVariables } from '../schemas.ts';

type ValidateAuthenticationSettingsInput = {
  readonly variables: Pick<
    WorkerVariables,
    'origin' | 'githubClientId' | 'githubClientSecret' | 'localBootstrapSecret'
  >;
};

/** Requires a complete sign-in configuration and restricts local bootstrap to loopback origins. */
export const validateAuthenticationSettings = Effect.fn('validateAuthenticationSettings')(function* ({
  variables,
}: ValidateAuthenticationSettingsInput): Effect.fn.Return<void, WorkerMisconfigured> {
  if (Option.isSome(variables.localBootstrapSecret) && !LOOPBACK_HOSTS.has(variables.origin.hostname)) {
    return yield* new WorkerMisconfigured({ reason: 'local bootstrap requires a loopback origin' });
  }

  if (Option.isSome(variables.githubClientId) !== Option.isSome(variables.githubClientSecret)) {
    return yield* new WorkerMisconfigured({ reason: 'GitHub sign-in requires both its client id and secret' });
  }

  if (Option.isNone(variables.githubClientId) && Option.isNone(variables.localBootstrapSecret)) {
    return yield* new WorkerMisconfigured({ reason: 'configure GitHub sign-in or local bootstrap' });
  }
});
