import type { WorkerSettings } from '@mechane/bindings';
import type { AccessFailure, Operation, OperationFailure, RequestInvalid } from '@mechane/protocol';
import { Effect, Schema } from 'effect';
import { admit } from '../admission/admit.ts';
import { decodeRequest } from './decode-request.ts';
import type { OperationWork, Peer, RoutedRequest } from './types.ts';

type ServeOperationInput<O extends Operation> = {
  readonly operation: O;
  readonly work: OperationWork<O>;
  readonly routed: RoutedRequest;
  readonly settings: WorkerSettings;
  readonly peer: Peer;
};

/** Serves a routed request: admits its caller, decodes its input, runs the operation's work and encodes the output. */
export const serveOperation = Effect.fn('serveOperation')(function* <O extends Operation>({
  operation,
  work,
  routed,
  settings,
  peer,
}: ServeOperationInput<O>): Effect.fn.Return<
  Response,
  AccessFailure<O['access']> | RequestInvalid | OperationFailure<O>
> {
  // Inference would widen the access to its constraint, so the call names the operation's own access type.
  const caller = yield* admit<O['access']>({
    access: operation.access,
    request: routed.request,
    params: routed.params,
    settings,
  });

  const input = yield* decodeRequest({ operation, routed });
  const output = yield* work({ input, settings, caller, peer });
  // Output that the operation's own schema rejects is a defect of the Worker, not of the request.
  const body = Schema.encodeSync(operation.output)(output);

  return Response.json(body);
});
