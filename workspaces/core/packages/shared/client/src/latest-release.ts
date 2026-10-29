import { latestReleaseUrl, ReleaseManifest } from '@mechane/protocol';
import { HttpHeader, HttpMethod } from '@mechane/records';
import { Effect } from 'effect';
import type { Duration } from 'effect';
import { answerWithin } from './answer-within.ts';
import { RELEASE_READ_FAILURES } from './constants.ts';
import { decodeAnswer } from './decode-answer.ts';
import type { ClientFailure } from './types.ts';

/** The deployment whose latest release to read, how long the read may take, and the program that reads it. */
type LatestReleaseInput = { readonly origin: URL; readonly timeout: Duration.Duration; readonly userAgent: string };

/** The manifest of the latest release the deployment at `origin` publishes, read within the timeout. */
export const latestRelease = Effect.fn('latestRelease')(function* ({
  origin,
  timeout,
  userAgent,
}: LatestReleaseInput): Effect.fn.Return<ReleaseManifest, ClientFailure> {
  const url = latestReleaseUrl({ origin });

  return yield* answerWithin({
    url,
    init: { method: HttpMethod.Get, headers: { [HttpHeader.UserAgent]: userAgent } },
    timeout,
    read: (response) => decodeAnswer({ output: ReleaseManifest, failures: RELEASE_READ_FAILURES, response, url }),
  });
});
