import { LOCAL_OWNER_IDENTITY } from '@mechane/records';
import { Effect, Option } from 'effect';
import type { Scope } from 'effect';
import type { StackFailed } from './errors.ts';
import { verifyOriginFree } from './loopback/verify-origin-free.ts';
import { localModelSettings } from './settings/local-model-settings.ts';
import { startRuntime } from './start-runtime.ts';
import { persistentStateFolder } from './state/persistent-state-folder.ts';
import type { LocalStack, RuntimeProject, StackSettings } from './types.ts';

type StartLocalStackInput = { readonly settings: StackSettings; readonly project: RuntimeProject };

/** Starts the production Worker on retained local state with configured models and the stable bootstrap identity. */
export const startLocalStack = Effect.fn('startLocalStack')(function* ({
  settings,
  project,
}: StartLocalStackInput): Effect.fn.Return<LocalStack, StackFailed, Scope.Scope> {
  yield* localModelSettings({ settings });

  const state = yield* persistentStateFolder({ settings });
  const { bootstrapSecret, bootstrapSecretFile, credentialKeyring, ...layout } = state;
  const configuredAdministrators = Option.fromNullishOr(settings.workerVariables.administratorIdentities);

  const administratorIdentities = Option.getOrElse(configuredAdministrators, () =>
    JSON.stringify([LOCAL_OWNER_IDENTITY]),
  );

  yield* verifyOriginFree({ origin: settings.localOrigin });

  const runtime = yield* startRuntime({
    settings,
    layout,
    origin: settings.localOrigin,
    sandboxProvider: settings.sandboxProvider,
    isPersistent: true,
    project,
    variables: {
      credentialKeyring,
      ...settings.workerVariables,
      origin: settings.localOrigin.origin,
      sandboxProvider: settings.sandboxProvider,
      localBootstrapSecret: bootstrapSecret,
      administratorIdentities,
    },
  });

  return { ...runtime, bootstrapSecretFile };
});
