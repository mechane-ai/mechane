import type { WorkerSettings } from '@mechane/bindings';
import { bearerAuthorization, GitHubPath, GitHubUser } from '@mechane/protocol';
import { HttpHeader, MediaType } from '@mechane/records';
import { Effect, Redacted } from 'effect';
import { GitHubStep } from '../constants.ts';
import type { GitHubUnavailable } from '../errors.ts';
import { githubAnswer } from './github-answer.ts';

type SignedInUserInput = { readonly settings: WorkerSettings; readonly accessToken: Redacted.Redacted };

/** The `user-agent` GitHub's API requires of every request. */
const USER_AGENT = 'mechane';

/** Reads the GitHub user an access token signs in as, from GitHub's REST API. */
export const signedInUser = Effect.fn('signedInUser')(function* ({
  settings,
  accessToken,
}: SignedInUserInput): Effect.fn.Return<GitHubUser, GitHubUnavailable> {
  const request = new Request(new URL(GitHubPath.User, settings.githubApiOrigin), {
    headers: {
      [HttpHeader.Accept]: MediaType.GitHubJson,
      [HttpHeader.Authorization]: bearerAuthorization({ token: Redacted.value(accessToken) }),
      [HttpHeader.UserAgent]: USER_AGENT,
    },
  });

  return yield* githubAnswer({ request, step: GitHubStep.ReadUser, answer: GitHubUser });
});
