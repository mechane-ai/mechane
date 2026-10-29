import type { AssistantMessageEventStream, StreamOptions } from '@earendil-works/pi-ai';
import type { ModelOffer } from '@mechane/deployment';
import type { TokenUsage } from '@mechane/protocol';
import type { Option } from 'effect';

/**
 * A dispatch to reserve, with the bytes of the context it sends, which bound its input tokens. The session id names the
 * conversation that sends it, and pi aborts its request with the signal.
 */
export type ReserveInput = {
  readonly offer: ModelOffer;
  readonly contextBytes: number;
  readonly sessionId: string;
  readonly signal: AbortSignal;
};

/** What a dispatch settles with. */
export type SettleInput = {
  /** The usage the upstream reported for the dispatch, none when it reported no tokens. */
  readonly usage: Option.Option<TokenUsage>;
};

/**
 * A held reservation, which the dispatch settles once, and the end user the dispatch is sent for. The end user is its
 * workspace's id, which holds no personal data and tells one workspace's requests from another's.
 */
export type GrantedReservation = {
  readonly _tag: 'Granted';
  readonly endUserId: string;
  readonly settle: (input: SettleInput) => Promise<void>;
};

/** A refusal, already recorded on the turn or the drone. */
type RefusedReservation = { readonly _tag: 'Refused' };

/** The ledger's answer to a dispatch. */
export type Reservation = GrantedReservation | RefusedReservation;

/** The ledger every model request of a mech passes through before it leaves the object. */
export type DispatchMeter = { readonly reserve: (input: ReserveInput) => Promise<Reservation> };

/**
 * The stream options a granted dispatch adds to pi's: at most the request's own output limit, never more than its
 * offer's, and the end user's id in its body.
 */
export type DispatchOptions = Readonly<Required<Pick<StreamOptions, 'maxTokens' | 'onPayload'>>>;

/** Sends a granted dispatch upstream with the options its grant adds to pi's. */
export type SendDispatch = (options: DispatchOptions) => AssistantMessageEventStream;
