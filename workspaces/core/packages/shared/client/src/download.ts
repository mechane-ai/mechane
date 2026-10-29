import { HttpHeader, HttpMethod } from '@mechane/records';
import { Effect, Schema } from 'effect';
import type { Duration } from 'effect';
import { answerWithin } from './answer-within.ts';
import { RELEASE_READ_FAILURES } from './constants.ts';
import { decodeAnswer } from './decode-answer.ts';
import { OriginUnreachable } from './errors.ts';
import type { ClientFailure } from './types.ts';

/** The file to download, how long its whole download may take, and the program that downloads it. */
type DownloadInput = { readonly url: URL; readonly timeout: Duration.Duration; readonly userAgent: string };

/** The answer that should hold a file, and the file's URL, which a failure names. */
type FileBytesInput = { readonly response: Response; readonly url: URL };

/** Downloads the bytes of a file the deployment serves, such as a release's binary, within the timeout. */
export const download = Effect.fn('download')(function* ({
  url,
  timeout,
  userAgent,
}: DownloadInput): Effect.fn.Return<Uint8Array, ClientFailure> {
  return yield* answerWithin({
    url,
    init: { method: HttpMethod.Get, headers: { [HttpHeader.UserAgent]: userAgent } },
    timeout,
    read: (response) => fileBytes({ response, url }),
  });
});

/**
 * The bytes of an answer that holds the file. Any other answer is the deployment's error, such as for a file no release
 * published, so it decodes as one: no success decodes in place of a file.
 */
const fileBytes = Effect.fn('fileBytes')(function* ({
  response,
  url,
}: FileBytesInput): Effect.fn.Return<Uint8Array, ClientFailure> {
  if (!response.ok) {
    return yield* decodeAnswer({ output: Schema.Never, failures: RELEASE_READ_FAILURES, response, url });
  }

  return yield* Effect.tryPromise({
    try: () => response.bytes(),
    catch: (cause) => new OriginUnreachable({ url, reason: String(cause) }),
  });
});
