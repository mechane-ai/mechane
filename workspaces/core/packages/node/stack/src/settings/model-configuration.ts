import { ModelOffersVariable } from '@mechane/deployment';
import { Effect, Schema } from 'effect';
import { readFile } from 'node:fs/promises';
import { LocalCommand, StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import type { StackVariables } from '../types.ts';

type ModelConfigurationInput = { readonly args: ReadonlyArray<string> };
type ModelConfiguration = { readonly localCommand: string; readonly workerVariables: StackVariables };
const CONFIGURATION_FLAG = '--config';

const ConfigurationArguments = Schema.Tuple([
  Schema.Literal(LocalCommand.Start),
  Schema.Literal(CONFIGURATION_FLAG),
  Schema.NonEmptyString,
]);

const ModelFile = Schema.fromJsonString(
  Schema.Struct({
    model_upstream: Schema.NonEmptyString,
    model_api_key: Schema.NonEmptyString,
    model_offers: Schema.Unknown,
  }),
);

/** Reads only the explicitly named data file and never includes its values in a diagnostic. */
export const modelConfiguration = Effect.fn('modelConfiguration')(function* ({
  args,
}: ModelConfigurationInput): Effect.fn.Return<ModelConfiguration, StackFailed> {
  if (!args.includes(CONFIGURATION_FLAG)) {
    return { localCommand: args.join(' '), workerVariables: {} };
  }

  const refused = new StackFailed({
    step: StackStep.ReadLocalSettings,
    reason: 'use start --config PATH with a valid model configuration',
  });

  const parsed = yield* Schema.decodeUnknownEffect(ConfigurationArguments)(args).pipe(Effect.mapError(() => refused));
  const path = parsed[2];
  const workerVariables = yield* readModelFile({ path, refused });

  return { localCommand: LocalCommand.Start, workerVariables };
});

type ReadModelFileInput = { readonly path: string; readonly refused: StackFailed };

const readModelFile = Effect.fn('readModelFile')(function* ({
  path,
  refused,
}: ReadModelFileInput): Effect.fn.Return<StackVariables, StackFailed> {
  const options = { onExcessProperty: 'error' } as const;

  const text = yield* Effect.tryPromise({
    try: () => readFile(path, 'utf8'),
    catch: () =>
      new StackFailed({ step: StackStep.ReadLocalSettings, reason: 'model configuration could not be read' }),
  });

  const configuration = yield* Schema.decodeUnknownEffect(
    ModelFile,
    options,
  )(text).pipe(Effect.mapError(() => refused));

  const modelOffers = JSON.stringify(configuration.model_offers);

  yield* Schema.decodeUnknownEffect(ModelOffersVariable, options)(modelOffers).pipe(Effect.mapError(() => refused));

  return { modelUpstream: configuration.model_upstream, modelApiKey: configuration.model_api_key, modelOffers };
});
