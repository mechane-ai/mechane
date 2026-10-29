import type { StepFailureClass, StepSubject } from '@mechane/program';
import { Effect, Option, Schema } from 'effect';
import type { SchemaAST } from 'effect';
import { parse, printParseErrorCode } from 'jsonc-parser';
import type { ParseError } from 'jsonc-parser';

/**
 * JSON with comments to decode, the schema and options it decodes with, and the step, what the text came from, and the
 * failure it fails as.
 */
type DecodeJsoncInput<C, S, E> = {
  readonly text: string;
  readonly schema: C;
  readonly options: SchemaAST.ParseOptions;
  readonly step: S;
  readonly subjects: ReadonlyArray<StepSubject>;
  readonly failure: StepFailureClass<S, E>;
};

type ParsedJsoncInput = { readonly text: string };

/** JSON with comments whose syntax the parser refused: the parser's word for its first error, and where it is. */
class JsoncSyntaxRefused extends Schema.TaggedError<JsoncSyntaxRefused>()('JsoncSyntaxRefused', {
  reason: Schema.String,
  offset: Schema.Int,
}) {}

/**
 * Decodes JSON with comments and trailing commas, such as a Wrangler configuration's text, with the schema, failing as
 * the program's `failure` of `step`, naming the text's `subjects`. A syntax error fails with its offset, where the
 * parser alone would drop the broken member and decode the rest.
 */
export const decodeJsonc = Effect.fn('decodeJsonc')(function* <C extends Schema.Codec<unknown, unknown>, S, E>({
  text,
  schema,
  options,
  step,
  subjects,
  failure: Failure,
}: DecodeJsoncInput<C, S, E>): Effect.fn.Return<C['Type'], E> {
  const syntaxFailure: (refused: JsoncSyntaxRefused) => E = ({ reason, offset }) =>
    new Failure({ step, subjects, reason: `${reason} at offset ${offset}` });

  const value = yield* parsedJsonc({ text }).pipe(Effect.mapError(syntaxFailure));

  return yield* Schema.decodeUnknownEffect(
    schema,
    options,
  )(value).pipe(Effect.mapError((error) => new Failure({ step, subjects, reason: error.message })));
});

/** The value the text holds, read as JSON with comments and trailing commas. */
const parsedJsonc = Effect.fn('parsedJsonc')(function* ({
  text,
}: ParsedJsoncInput): Effect.fn.Return<unknown, JsoncSyntaxRefused> {
  const errors: Array<ParseError> = [];
  const value: unknown = parse(text, errors, { allowTrailingComma: true });
  const first = Option.fromNullishOr(errors[0]);

  if (Option.isSome(first)) {
    return yield* new JsoncSyntaxRefused({
      reason: printParseErrorCode(first.value.error),
      offset: first.value.offset,
    });
  }

  return value;
});
