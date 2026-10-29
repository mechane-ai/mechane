import type { WorkerSettings } from '@mechane/bindings';
import { catalog } from '@mechane/protocol';
import type { OperationName, ServerFailure } from '@mechane/protocol';
import { Effect } from 'effect';
import { OPERATIONS } from './operations.ts';
import { serveOperation } from './serve-operation.ts';
import type { Peer, RoutedRequest } from './types.ts';

type ServeNamedInput<N extends OperationName> = {
  readonly name: N;
  readonly routed: RoutedRequest;
  readonly settings: WorkerSettings;
  readonly peer: Peer;
};

/** Serves a request the router matched to the named operation, with that operation's work. */
export const serveNamed = Effect.fn('serveNamed')(function* <N extends OperationName>({
  name,
  routed,
  settings,
  peer,
}: ServeNamedInput<N>): Effect.fn.Return<Response, ServerFailure> {
  return yield* serveOperation({ operation: catalog[name], work: OPERATIONS[name], routed, settings, peer });
});
