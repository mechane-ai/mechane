import { APIError } from '@anthropic-ai/sdk';
import { Data, Effect, Schema } from 'effect';
import { EvalAdapterFailed, EvalAdapterOperation } from './errors.ts';

type ManagedRequest<A> = { readonly action: string; readonly operation: (signal: AbortSignal) => PromiseLike<A> };
type FailureInput = { readonly action: string; readonly cause: unknown };
type Cause = { readonly cause: unknown };

const isSdkError = Schema.is(Schema.instanceOf(APIError));
class RequestRejected extends Data.TaggedError('RequestRejected')<Cause> {}

/** Retain the SDK's response status so recovery can distinguish a rejection from a lost acknowledgment. */
export function managedFailure({ action, cause }: FailureInput): EvalAdapterFailed {
  const failure = { operation: EvalAdapterOperation.ManagedRequest, reason: `${action}: ${String(cause)}` };

  if (isSdkError(cause) && typeof cause.status === 'number') {
    return new EvalAdapterFailed({ ...failure, httpStatus: cause.status });
  }

  return new EvalAdapterFailed(failure);
}

export const managedRequest = Effect.fn('managedRequest')(function* <A>({
  action,
  operation,
}: ManagedRequest<A>): Effect.fn.Return<A, EvalAdapterFailed> {
  const request = Effect.tryPromise({
    try: (signal) => operation(signal),
    catch: (cause) => new RequestRejected({ cause }),
  });

  return yield* request.pipe(Effect.mapError(({ cause }) => managedFailure({ action, cause })));
});
