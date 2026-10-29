import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { StackFailed } from '../errors.ts';
import { serveRequests } from '../loopback/serve-requests.ts';
import type { ServedAnswer, ServedRequest } from '../types.ts';
import { answerGitHubRequest } from './answer-github-request.ts';
import { createGitHubLedger } from './create-github-ledger.ts';
import type { LocalGitHub } from './types.ts';

type StartFakeGitHubInput = { readonly github: LocalGitHub };

/**
 * Serves a local GitHub on a loopback port until the scope closes, and answers with its origin. Its OAuth web flow
 * signs a browser in as any login the person types, by default the configured one, and its API reports that user.
 */
export const startFakeGitHub = Effect.fn('startFakeGitHub')(function* ({
  github,
}: StartFakeGitHubInput): Effect.fn.Return<URL, StackFailed, Scope.Scope> {
  const ledger = createGitHubLedger();

  const answer: (request: ServedRequest) => ServedAnswer = ({ method, url, headers, body }) =>
    answerGitHubRequest({
      request: { method, url, form: new URLSearchParams(body), authorization: headers.authorization },
      ledger,
      github,
    });

  return yield* serveRequests({ answer });
});
