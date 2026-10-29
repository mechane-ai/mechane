import { decodeRequestPart, RequestInvalid } from '@mechane/protocol';
import type { Operation, OperationInput, OperationMethod } from '@mechane/protocol';
import { HttpMethod } from '@mechane/records';
import { Effect, Record } from 'effect';
import type { RoutedRequest } from './types.ts';

type DecodeRequestInput<O extends Operation> = { readonly operation: O; readonly routed: RoutedRequest };

type ReadBodyInput = { readonly request: Request; readonly method: OperationMethod };

/**
 * Decodes the operation's input from the request's path parameters, query and a mutation's JSON body. Each part refuses
 * a field its schema does not declare, so no part's field can stand in for another's.
 */
export const decodeRequest = Effect.fn('decodeRequest')(function* <O extends Operation>({
  operation,
  routed,
}: DecodeRequestInput<O>): Effect.fn.Return<OperationInput<O>, RequestInvalid> {
  const rawParams = yield* Effect.try({
    try: () => Record.map(routed.params, decodeURIComponent),
    catch: () => new RequestInvalid({ reason: 'a path parameter is not valid percent-encoding' }),
  });

  const rawBody = yield* readBody({ request: routed.request, method: operation.method });
  const params = yield* decodeRequestPart({ schema: operation.params, value: rawParams });

  const query = yield* decodeRequestPart({
    schema: operation.query,
    value: Record.fromEntries(routed.url.searchParams),
  });

  const body = yield* decodeRequestPart({ schema: operation.body, value: rawBody });

  return { ...params, ...query, ...body };
});

/** A `GET` carries no body, so its operation's body schema decodes an empty object. */
const readBody = Effect.fn('readBody')(function* ({
  request,
  method,
}: ReadBodyInput): Effect.fn.Return<unknown, RequestInvalid> {
  switch (method) {
    case HttpMethod.Get:
      return {};
    case HttpMethod.Post:
    case HttpMethod.Put:
    case HttpMethod.Delete:
      return yield* Effect.tryPromise({
        try: (): Promise<unknown> => request.json(),
        catch: () => new RequestInvalid({ reason: 'the body is not JSON' }),
      });
  }
});
