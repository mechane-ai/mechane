import { ObjectUnavailable } from '@mechane/protocol';
import type { DurableObjectClass, ServiceFreeCodec } from '@mechane/protocol';
import { Effect, Schema } from 'effect';

type CallObjectInput<S> = {
  readonly objectClass: DurableObjectClass;
  /** The RPC to make; its answer is plain data that `answer` decodes. */
  readonly call: () => Promise<unknown>;
  readonly answer: S;
};

/**
 * Calls a Durable Object by RPC and decodes its plain answer; a call that rejects or answers in another shape leaves
 * the object unavailable to the request.
 */
export const callObject = Effect.fn('callObject')(function* <S extends ServiceFreeCodec>({
  objectClass,
  call,
  answer,
}: CallObjectInput<S>): Effect.fn.Return<S['Type'], ObjectUnavailable> {
  const value = yield* Effect.tryPromise({
    try: () => call(),
    catch: (cause) => new ObjectUnavailable({ objectClass, reason: String(cause) }),
  });

  return yield* Schema.decodeUnknownEffect(answer)(value).pipe(
    Effect.mapError((error) => new ObjectUnavailable({ objectClass, reason: error.message })),
  );
});
