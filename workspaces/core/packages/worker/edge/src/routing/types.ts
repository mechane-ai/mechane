import type { WorkerSettings } from '@mechane/bindings';
import type { Operation, OperationFailure, OperationInput, OperationOutput } from '@mechane/protocol';
import type { Effect, Option } from 'effect';
import type { AccessCaller, RawPathParams } from '../types.ts';

/** The address and country of the client a request came from, as the platform reports them. */
export type Peer = {
  /** Absent where the platform reports no address, as a local stack's runtime does. */
  readonly address: Option.Option<string>;
  /** Absent where the platform reports no country, as a local stack's runtime does. */
  readonly country: Option.Option<string>;
};

/** One request after routing: what admission and the operation's schemas read. */
export type RoutedRequest = { readonly request: Request; readonly url: URL; readonly params: RawPathParams };

export type PeerInput = { readonly request: Request };

export type WorkInput<O extends Operation> = {
  readonly input: OperationInput<O>;
  readonly settings: WorkerSettings;
  readonly caller: AccessCaller[O['access']];
  readonly peer: Peer;
};

/** The work behind one operation; the router admits the caller, decodes its input and encodes its output. */
export type OperationWork<O extends Operation> = (
  input: WorkInput<O>,
) => Effect.Effect<OperationOutput<O>, OperationFailure<O>>;
