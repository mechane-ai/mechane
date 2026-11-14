import { Effect, Schema } from 'effect';
import type { GradeSchemaDefinition } from './application-schemas.ts';
import type { DecodeGradeInput, EvalGradeSchema, Json } from './application-types.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from './errors.ts';

type DefineGradeSchemaInput<S extends Schema.Codec<unknown, unknown>> = Pick<
  GradeSchemaDefinition,
  'id' | 'version'
> & { readonly schema: S };

/** One codec supplies the judge's tool schema and strict grade decoder. */
export const defineGradeSchema = Effect.fn('defineGradeSchema')(function* <S extends Schema.Codec<unknown, unknown>>({
  id,
  version,
  schema,
}: DefineGradeSchemaInput<S>): Effect.fn.Return<EvalGradeSchema, EvalAdapterFailed> {
  const document = yield* Effect.try({
    try: () => Schema.toJsonSchemaDocument(schema),
    catch: (cause) =>
      new EvalAdapterFailed({ operation: EvalAdapterOperation.DefineGradeSchema, reason: String(cause) }),
  });

  const jsonSchema = yield* Schema.decodeUnknownEffect(Schema.Json)({
    ...document.schema,
    $defs: document.definitions,
  }).pipe(
    Effect.mapError(
      (failure) =>
        new EvalAdapterFailed({ operation: EvalAdapterOperation.DefineGradeSchema, reason: failure.message }),
    ),
  );

  const decode: EvalGradeSchema['decode'] = Effect.fn('decode')(function* ({
    value,
  }: DecodeGradeInput): Effect.fn.Return<Json, EvalAdapterFailed> {
    const decoded = yield* Schema.decodeUnknownEffect(schema, { onExcessProperty: 'error' })(value).pipe(
      Effect.mapError(
        (failure) => new EvalAdapterFailed({ operation: EvalAdapterOperation.DecodeGrade, reason: failure.message }),
      ),
    );

    return yield* Schema.decodeUnknownEffect(Schema.Json)(decoded).pipe(
      Effect.mapError(
        (failure) =>
          new EvalAdapterFailed({ operation: EvalAdapterOperation.DecodeGradeJson, reason: failure.message }),
      ),
    );
  });

  return { definition: { id, version, jsonSchema }, decode };
});
