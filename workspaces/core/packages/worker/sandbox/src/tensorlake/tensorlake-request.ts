import { bearerAuthorization } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { Duration, Option, Redacted, Result } from 'effect';
import { TensorlakeRefused } from './errors.ts';

const TENSORLAKE_REQUEST_TIMEOUT = Duration.seconds(20);
type TensorlakeRequest = { readonly apiKey: Redacted.Redacted; readonly url: URL; readonly init: RequestInit };

/** Makes a bounded provider request without following a redirect that could disclose the credential. */
export async function tensorlakeRequest({ apiKey, url, init }: TensorlakeRequest): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = Redacted.value(apiKey);
  const authorization = bearerAuthorization({ token });

  headers.set(HttpHeader.Authorization, authorization);

  if (!headers.has(HttpHeader.ContentType)) {
    headers.set(HttpHeader.ContentType, MediaType.Json);
  }

  const timeout = Duration.toMillis(TENSORLAKE_REQUEST_TIMEOUT);
  const signal = AbortSignal.timeout(timeout);
  const response = await fetch(url, { ...init, headers, redirect: 'manual', signal });
  const isExpected = response.status === HttpStatusCode.NotFound || response.status === HttpStatusCode.Conflict;

  if (!response.ok && !isExpected) {
    const body = Option.fromNullishOr(response.body);

    if (Option.isSome(body)) {
      await body.value.cancel();
    }

    const failure = new TensorlakeRefused({ url, status: response.status });
    const refused = Result.fail(failure);

    // Durable Object methods use the plain dialect; a rejected provider call leaves the committed intent retryable.
    return Result.getOrThrow(refused);
  }

  return response;
}
