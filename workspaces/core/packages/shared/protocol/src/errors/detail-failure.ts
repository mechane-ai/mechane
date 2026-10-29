import { wireKey } from '@mechane/records';
import { Array, Effect, Option, Record, Schema, Struct } from 'effect';
import { UnknownFailure } from './errors.ts';
import type { ServerFailure } from './errors.ts';
import type { ErrorDetail } from './schemas.ts';
import type { FailureCodec } from './types.ts';

/** An error detail, and the failures its reader expects, which a code outside them leaves unknown. */
type DetailFailureInput = { readonly detail: ErrorDetail; readonly failures: ReadonlyArray<FailureCodec> };

/**
 * The failure an error detail reports: the expected one its code names, decoded with its own fields, or an
 * `UnknownFailure`. A code outside `failures`, such as one a newer deployment added, is unknown, and its reader handles
 * it by the detail's family. An expected code whose fields do not decode fails with the schema's issue.
 */
export const detailFailure = Effect.fn('detailFailure')(function* ({
  detail,
  failures,
}: DetailFailureInput): Effect.fn.Return<ServerFailure | UnknownFailure, Schema.SchemaError> {
  const { code } = detail;
  const fields = Struct.omit(detail, ['family', 'code', 'message']);
  const expected = Array.findFirst(failures, (failure) => failure.identifier === code);

  if (Option.isNone(expected)) {
    return new UnknownFailure({ code, fields });
  }

  // Each wire key derives from its field forward, as `errorDetail` wrote it; a key the failure does not declare stays.
  const keyedField: (field: string) => readonly [string, string] = (field) => [wireKey({ field }), field];
  const fieldNames: ReadonlyMap<string, string> = new Map(Record.keys(expected.value.fields).map(keyedField));

  const fieldName: (key: string) => string = (key) =>
    Option.getOrElse(Option.fromNullishOr(fieldNames.get(key)), () => key);

  return yield* Schema.decodeUnknownEffect(expected.value)({ _tag: code, ...Record.mapKeys(fields, fieldName) });
});
