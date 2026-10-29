import { GitHubTokenAnswer, GitHubTokenRequest } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { Option, Record, Redacted, Result, Schema } from 'effect';
import type { ServedAnswer } from '../types.ts';
import { jsonAnswer } from './json-answer.ts';
import type { RouteInput } from './types.ts';

/** Exchanges a granted code for an access token, for the registered client only; GitHub reports a refusal with 200. */
export function exchangeCode({ request, ledger, github }: RouteInput): ServedAnswer {
  const isRegisteredClient: (exchange: GitHubTokenRequest) => boolean = ({ clientId, clientSecret }) =>
    clientId === github.clientId && Redacted.value(clientSecret) === github.clientSecret;

  const tokenAnswer: (login: string) => GitHubTokenAnswer = (login) => ({
    accessToken: Redacted.make(ledger.issueAccessToken({ login })),
  });

  const exchange = Option.filter(
    Result.getSuccess(Schema.decodeUnknownResult(GitHubTokenRequest)(Record.fromEntries(request.form))),
    isRegisteredClient,
  );

  const login = Option.flatMap(exchange, ({ code, redirectUri }) => ledger.redeemCode({ code, redirectUri }));
  const answer = Option.match(login, { onNone: () => ({ error: 'bad_verification_code' }), onSome: tokenAnswer });

  return jsonAnswer({ status: HttpStatusCode.Ok, body: Schema.encodeSync(GitHubTokenAnswer)(answer) });
}
