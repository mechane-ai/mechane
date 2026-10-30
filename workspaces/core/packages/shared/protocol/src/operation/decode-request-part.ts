import { Effect, Schema } from 'effect';
import { RequestInvalid } from '../errors/errors.ts';
import type { ServiceFreeCodec } from './types.ts';

/** The schema of one part of a request, and the part as the request carried it. */
type DecodeRequestPartInput<S> = { readonly schema: S; readonly value: unknown };

/**
 * Decodes one part of a request, its path or query parameters or its body, refusing a field its schema does not
 * declare. A part that does not decode is the request's `RequestInvalid`.
 */
export const decodeRequestPart = Effect.fn('decodeRequestPart')(function* <S extends ServiceFreeCodec>({
  schema,
  value,
}: DecodeRequestPartInput<S>): Effect.fn.Return<S['Type'], RequestInvalid> {
  return yield* Schema.decodeUnknownEffect(schema, { onExcessProperty: 'error' })(value).pipe(
    Effect.mapError(() => new RequestInvalid({ reason: 'request fields do not match the operation schema' })),
  );
});
