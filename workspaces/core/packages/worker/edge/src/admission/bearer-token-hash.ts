import { tokenHash } from '@mechane/credentials';
import { BEARER_SCHEME, KeyMissing, KeyToken, KeyUnrecognized } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import { Effect, Option, Redacted, Schema } from 'effect';

/** The bearer scheme in any letter case, since HTTP compares authorization schemes without regard to case. */
const BEARER_SCHEME_PATTERN: Readonly<RegExp> = new RegExp(`^${BEARER_SCHEME}$`, 'i');

/** An `authorization` header carrying a Mechane key, decoded into the scheme, its separator and the redacted key. */
const BearerAuthorization = Schema.TemplateLiteralParser([
  Schema.String.check(Schema.isPattern(BEARER_SCHEME_PATTERN)),
  ' ',
  KeyToken,
]);

type BearerAuthorization = typeof BearerAuthorization.Type;

type BearerTokenHashInput = { readonly request: Request };

/** The hash of the key in the request's `authorization` header; a header holding no Mechane key is an invalid key. */
export const bearerTokenHash = Effect.fn('bearerTokenHash')(function* ({
  request,
}: BearerTokenHashInput): Effect.fn.Return<string, KeyMissing | KeyUnrecognized> {
  const authorization = Option.fromNullishOr(request.headers.get(HttpHeader.Authorization));

  if (Option.isNone(authorization)) {
    return yield* new KeyMissing();
  }

  const header: BearerAuthorization = yield* Schema.decodeUnknownEffect(BearerAuthorization)(authorization.value).pipe(
    Effect.mapError(() => new KeyUnrecognized()),
  );

  return yield* tokenHash({ token: Redacted.value(header[2]) });
});
