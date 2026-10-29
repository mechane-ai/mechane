import type { Access, catalog, OperationInput, OperationName, OperationOutput } from '@mechane/protocol';
import type { Effect, Option, Redacted } from 'effect';
import type { OperationFailed, OriginUnreachable, RequestTimedOut, ResponseUnreadable } from './errors.ts';

/** Every way a call fails: the server's error, no server answering in time, or an answer the client cannot read. */
export type ClientFailure = OperationFailed | OriginUnreachable | RequestTimedOut | ResponseUnreadable;

/** The credential each access sends: a principal or member operation sends a Mechane key, and a public one none. */
export type AccessCredential = {
  /** Always none: a public operation sends no key. */
  readonly [Access.Public]: Option.Option<never>;
  readonly [Access.Principal]: Redacted.Redacted;
  readonly [Access.Member]: Redacted.Redacted;
};

/** What one call sends: the operation's name, its input, and the credential its access needs. */
export type CallRequest<N extends OperationName> = {
  readonly name: N;
  readonly input: OperationInput<(typeof catalog)[N]>;
  readonly credential: AccessCredential[(typeof catalog)[N]['access']];
};

/**
 * Calls one of the operations `O` names, at the origin and within the timeout its program bound. Its operations are
 * contravariant, so a call that permits fewer operations cannot pass for one that permits more.
 */
export type OperationCall<in O extends OperationName> = <M extends O>(
  request: CallRequest<M>,
) => Effect.Effect<OperationOutput<(typeof catalog)[M]>, ClientFailure>;
