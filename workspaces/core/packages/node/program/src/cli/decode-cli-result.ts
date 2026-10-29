import { Effect, Schema } from 'effect';

/** The JSON envelope a successful `--output json` run writes, read only for its result. */
const CliEnvelope = Schema.fromJsonString(Schema.Struct({ result: Schema.Unknown }));

type CliEnvelope = typeof CliEnvelope.Type;

type DecodeCliResultInput<S> = { readonly stdout: string; readonly result: S };

/** Decodes what a successful `--output json` run printed: its envelope, then the envelope's result with `result`. */
export const decodeCliResult = Effect.fn('decodeCliResult')(function* <S extends Schema.Codec<unknown, unknown>>({
  stdout,
  result,
}: DecodeCliResultInput<S>): Effect.fn.Return<S['Type'], Schema.SchemaError> {
  const envelope = yield* Schema.decodeUnknownEffect(CliEnvelope)(stdout);

  return yield* Schema.decodeUnknownEffect(result)(envelope.result);
});
