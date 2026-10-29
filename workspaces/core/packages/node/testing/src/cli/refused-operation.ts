import { call, OperationFailed } from '@mechane/client';
import type { CallRequest, ClientFailure } from '@mechane/client';
import type { OperationName } from '@mechane/protocol';
import type { Stack } from '@mechane/stack';
import { Duration, Effect, Schema } from 'effect';
import { CheckFailed } from '../errors.ts';

const REQUEST_TIMEOUT = Duration.seconds(20);

type RefusedOperationInput<N extends OperationName> = CallRequest<N> & { readonly stack: Stack };
type OperationRefusalInput = { readonly name: OperationName; readonly failure: ClientFailure };

/** Calls the server directly so CLI workspace selection cannot mask an authorization regression. */
export const refusedOperation = Effect.fn('refusedOperation')(function* <N extends OperationName>({
  stack,
  name,
  input,
  credential,
}: RefusedOperationInput<N>): Effect.fn.Return<string, CheckFailed> {
  const response = call({
    origin: stack.origin,
    name,
    input,
    credential,
    timeout: REQUEST_TIMEOUT,
    userAgent: 'mechane-smoke',
  });

  const onFailure: (failure: ClientFailure) => Effect.Effect<string, CheckFailed> = (failure) =>
    operationRefusal({ name, failure });

  const onSuccess: () => Effect.Effect<never, CheckFailed> = () =>
    new CheckFailed({ name, reason: 'the refused operation succeeded' });

  return yield* response.pipe(Effect.matchEffect({ onFailure, onSuccess }));
});

const operationRefusal = Effect.fn('operationRefusal')(function* ({
  name,
  failure,
}: OperationRefusalInput): Effect.fn.Return<string, CheckFailed> {
  const isOperationFailed = Schema.is(OperationFailed);

  if (isOperationFailed(failure)) {
    return failure.failure._tag;
  }

  return yield* new CheckFailed({ name, reason: `request failed with ${failure._tag}` });
});
