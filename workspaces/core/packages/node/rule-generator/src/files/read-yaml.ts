import { Effect, Schema } from 'effect';
import { parse } from 'yaml';
import { GenerateStep } from '../constants.ts';
import { GenerateFailed } from '../errors.ts';
import { readInput } from './read-input.ts';

/** A YAML file the generator reads, by its path relative to the workspace, and the schema of its value. */
type ReadYamlInput<S> = { readonly path: string; readonly schema: S };

/** The value of one YAML file the generator reads, decoded with its schema. */
export const readYaml = Effect.fn('readYaml')(function* <S extends Schema.Codec<unknown, unknown>>({
  path,
  schema,
}: ReadYamlInput<S>): Effect.fn.Return<S['Type'], GenerateFailed> {
  const text = yield* readInput({ path });

  const parsed = yield* Effect.try({
    try: (): unknown => parse(text),
    catch: (cause) => new GenerateFailed({ step: GenerateStep.Read, path, reason: String(cause) }),
  });

  /** A file whose value does not decode, at its path. */
  const undecodedFile: (error: Schema.SchemaError) => GenerateFailed = (error) =>
    new GenerateFailed({ step: GenerateStep.Read, path, reason: error.message });

  return yield* Schema.decodeUnknownEffect(schema)(parsed).pipe(Effect.mapError(undecodedFile));
});
