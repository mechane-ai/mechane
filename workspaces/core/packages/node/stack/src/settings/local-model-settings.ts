import { LocalSandboxProvider, ModelOffersVariable, SecureOrigin, WORKER_VARIABLES } from '@mechane/deployment';
import { Effect, Schema } from 'effect';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import type { StackSettings } from '../types.ts';

type LocalModelSettingsInput = { readonly settings: StackSettings };

const ModelSettings = Schema.Struct({
  modelUpstream: Schema.NonEmptyString,
  modelApiKey: Schema.NonEmptyString.check(Schema.isTrimmed()),
  modelOffers: Schema.NonEmptyString,
});

type ModelSettings = typeof ModelSettings.Type;

/** Requires containers and configured model credentials and offers for persistent mode. */
export const localModelSettings = Effect.fn('localModelSettings')(function* ({
  settings,
}: LocalModelSettingsInput): Effect.fn.Return<ModelSettings, StackFailed> {
  const step = StackStep.ReadLocalSettings;

  const missing: () => StackFailed = () =>
    new StackFailed({
      step,
      reason: `set ${WORKER_VARIABLES.modelUpstream}, ${WORKER_VARIABLES.modelApiKey} and ${WORKER_VARIABLES.modelOffers}`,
    });

  const insecure: () => StackFailed = () =>
    new StackFailed({ step, reason: `${WORKER_VARIABLES.modelUpstream} must use HTTPS or loopback HTTP` });

  const invalidOffers: () => StackFailed = () =>
    new StackFailed({ step, reason: `${WORKER_VARIABLES.modelOffers} must contain valid model offers` });

  if (settings.sandboxProvider !== LocalSandboxProvider.Container) {
    return yield* new StackFailed({ step, reason: 'persistent local mode requires Docker containers' });
  }

  const model = yield* Schema.decodeUnknownEffect(ModelSettings)(settings.workerVariables).pipe(
    Effect.mapError(missing),
  );

  yield* Schema.decodeUnknownEffect(SecureOrigin)(model.modelUpstream).pipe(Effect.mapError(insecure));
  yield* Schema.decodeUnknownEffect(ModelOffersVariable)(model.modelOffers).pipe(Effect.mapError(invalidOffers));

  return model;
});
