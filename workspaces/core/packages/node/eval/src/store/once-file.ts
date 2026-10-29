import { jsonFileText, readOptionalFile } from '@mechane/program';
import { Effect, Option, Schema } from 'effect';
import { EvalFileStep } from '../constants.ts';
import { EvalFileFailed } from '../errors.ts';
import type { OnceFile } from '../types.ts';
import { createRecordFile } from './create-record-file.ts';

type OnceFileInput<S extends Schema.Codec<unknown, unknown>> = { readonly path: string; readonly schema: S };

/** A file to read, and its record's schema as the file writes it. */
type ReadRecordInput<S extends Schema.Codec<unknown, unknown>> = {
  readonly path: string;
  readonly file: Schema.fromJsonString<S>;
};

/** The file at `path` that holds one record of `schema` as JSON, written once. */
export function onceFile<S extends Schema.Codec<unknown, unknown>>({
  path,
  schema,
}: OnceFileInput<S>): OnceFile<S['Type']> {
  const file = Schema.fromJsonString(schema);

  const create: OnceFile<S['Type']>['create'] = ({ record }) =>
    createRecordFile({ path, text: jsonFileText({ schema, value: record }) });

  return { path, read: () => readRecord({ path, file }), create };
}

/** The record the file at `path` holds, none when the file does not exist. */
const readRecord = Effect.fn('readRecord')(function* <S extends Schema.Codec<unknown, unknown>>({
  path,
  file,
}: ReadRecordInput<S>): Effect.fn.Return<Option.Option<S['Type']>, EvalFileFailed> {
  const text = yield* readOptionalFile({ path }).pipe(
    Effect.mapError(({ reason }) => new EvalFileFailed({ step: EvalFileStep.Read, path, reason })),
  );

  if (Option.isNone(text)) {
    return Option.none();
  }

  const record = yield* Schema.decodeUnknownEffect(file)(text.value).pipe(
    Effect.mapError((error) => new EvalFileFailed({ step: EvalFileStep.Decode, path, reason: error.message })),
  );

  return Option.some(record);
});
