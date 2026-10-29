import { StepSubject } from '@mechane/program';
import type { StepFailureClass } from '@mechane/program';
import { Effect } from 'effect';
import type { Schema, SchemaAST } from 'effect';
import { readFile } from 'node:fs/promises';
import { decodeJsonc } from './decode-jsonc.ts';

/** A file of JSON with comments, the schema and options it decodes with, and the step and failure it fails as. */
type ReadJsoncInput<C, S, E> = {
  readonly path: string;
  readonly schema: C;
  readonly options: SchemaAST.ParseOptions;
  readonly step: S;
  readonly failure: StepFailureClass<S, E>;
};

/**
 * Reads a file of JSON with comments, such as a Wrangler configuration, and decodes it as `decodeJsonc` does; its
 * failure names the file.
 */
export const readJsonc = Effect.fn('readJsonc')(function* <C extends Schema.Codec<unknown, unknown>, S, E>({
  path,
  schema,
  options,
  step,
  failure: Failure,
}: ReadJsoncInput<C, S, E>): Effect.fn.Return<C['Type'], E> {
  const subjects = [StepSubject.cases.Path.make({ path })];

  const text = yield* Effect.tryPromise({
    try: () => readFile(path, 'utf8'),
    catch: (cause) => new Failure({ step, subjects, reason: String(cause) }),
  });

  return yield* decodeJsonc({ text, schema, options, step, subjects, failure: Failure });
});
