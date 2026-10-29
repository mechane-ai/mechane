import { GitHubPath } from '@mechane/protocol';
import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { Array, Option } from 'effect';
import type { ServedAnswer } from '../types.ts';
import { exchangeCode } from './exchange-code.ts';
import { grantCode } from './grant-code.ts';
import { jsonAnswer } from './json-answer.ts';
import { signInPage } from './sign-in-page.ts';
import { signedInUser } from './signed-in-user.ts';
import type { RouteInput } from './types.ts';

/** One route of the local GitHub: the method and path it answers, and its answer. */
type GitHubRoute = {
  readonly method: HttpMethod;
  readonly path: string;
  readonly answer: (input: RouteInput) => ServedAnswer;
};

/** GitHub's OAuth web flow and user API, as far as a Mechane sign-in uses them. */
const ROUTES: ReadonlyArray<GitHubRoute> = [
  { method: HttpMethod.Get, path: GitHubPath.Authorize, answer: signInPage },
  { method: HttpMethod.Post, path: GitHubPath.Authorize, answer: grantCode },
  { method: HttpMethod.Post, path: GitHubPath.AccessToken, answer: exchangeCode },
  { method: HttpMethod.Get, path: GitHubPath.User, answer: signedInUser },
];

/** Answers one request as GitHub would, by the route its method and path name. */
export function answerGitHubRequest({ request, ledger, github }: RouteInput): ServedAnswer {
  const route = Array.findFirst(
    ROUTES,
    ({ method, path }) => method === request.method && path === request.url.pathname,
  );

  if (Option.isNone(route)) {
    return jsonAnswer({ status: HttpStatusCode.NotFound, body: { message: 'Not Found' } });
  }

  return route.value.answer({ request, ledger, github });
}
