import { BEARER_SCHEME, GitHubUser } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { Option, Result, Schema } from 'effect';
import type { ServedAnswer } from '../types.ts';
import { jsonAnswer } from './json-answer.ts';
import type { RouteInput } from './types.ts';

/** An `authorization` header that carries an access token, decoded into the scheme and the token. */
const BearerAuthorization = Schema.TemplateLiteralParser([`${BEARER_SCHEME} `, Schema.String]);

type BearerAuthorization = typeof BearerAuthorization.Type;

/** The user an access token signed in, with the id the ledger gave its login. */
export function signedInUser({ request, ledger }: RouteInput): ServedAnswer {
  const bearer = Result.getSuccess(Schema.decodeUnknownResult(BearerAuthorization)(request.authorization));
  const login = Option.flatMap(bearer, ([, token]) => ledger.tokenLogin({ token }));

  if (Option.isNone(login)) {
    return jsonAnswer({ status: HttpStatusCode.Unauthorized, body: { message: 'Bad credentials' } });
  }

  const user = Schema.encodeSync(GitHubUser)({ id: ledger.userId({ login: login.value }), login: login.value });

  return jsonAnswer({ status: HttpStatusCode.Ok, body: user });
}
