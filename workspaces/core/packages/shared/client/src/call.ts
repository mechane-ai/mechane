import { ACCESS_FAILURES, catalog, ROUTE_FAILURES } from '@mechane/protocol';
import type { OperationName, OperationOutput } from '@mechane/protocol';
import { Effect, Schema } from 'effect';
import type { Duration } from 'effect';
import { answerWithin } from './answer-within.ts';
import { decodeAnswer } from './decode-answer.ts';
import { requestInit } from './request-init.ts';
import { requestUrl } from './request-url.ts';
import type { CallRequest, ClientFailure } from './types.ts';

/** What one call sends, and where and how long it may wait. */
type CallInput<N extends OperationName> = CallRequest<N> & {
  /** The deployment's origin, such as `http://127.0.0.1:9876`. */
  readonly origin: URL;
  readonly timeout: Duration.Duration;
  /**
   * The `user-agent` of the request, which names the program that sends it and its release, such as `mechane/0.1.0
   * (linux-x64)`, so the operator sees which releases still call.
   */
  readonly userAgent: string;
};

/**
 * Calls one catalog operation with the credential its access needs and decodes its answer. An error decodes by the
 * failures the operation, its access's admission and every route declare. The timeout bounds the request and its read.
 */
export const call = Effect.fn('call')(function* <N extends OperationName>({
  origin,
  name,
  input,
  credential,
  timeout,
  userAgent,
}: CallInput<N>): Effect.fn.Return<OperationOutput<(typeof catalog)[N]>, ClientFailure> {
  const operation = catalog[name];
  const failures = [...operation.errors, ...ACCESS_FAILURES[operation.access], ...ROUTE_FAILURES];
  // The input already has the operation's types, so a part that fails to encode is a defect of the caller.
  const params = Schema.encodeSync(operation.params)(input);
  const query = Schema.encodeSync(operation.query)(input);
  const body = Schema.encodeSync(operation.body)(input);
  const url = requestUrl({ origin, path: operation.path, params, query });
  const init = requestInit({ method: operation.method, body, credential, userAgent });

  return yield* answerWithin({
    url,
    init,
    timeout,
    read: (response) => decodeAnswer({ output: operation.output, failures, response, url }),
  });
});
