import type { Api, AssistantMessageEvent, Model, StreamOptions, TranscriptContext } from '@earendil-works/pi-ai';
import type { ModelOffer } from '@mechane/deployment';
import { Array, Match, Option, Result, Schema } from 'effect';
import { endUserPayload } from './end-user-payload.ts';
import { settledEvents } from './settled-events.ts';
import type { DispatchMeter, SendDispatch, SettleInput } from './types.ts';

type MeteredEventsInput = {
  readonly piModel: Model<Api>;
  readonly context: TranscriptContext;
  readonly offers: ReadonlyArray<ModelOffer>;
  readonly meter: DispatchMeter;
  /** The options pi sent, always: its output limit, if any, its conversation's provider session id, and the signal. */
  readonly requested: Option.Option<Pick<StreamOptions, 'maxTokens' | 'sessionId' | 'signal'>>;
  readonly send: SendDispatch;
};

/**
 * The error that ends a dispatch the allowance refused. Its `quota exceeded` is one of pi-ai's non-retryable patterns,
 * and the text matches no retryable or context-overflow pattern, so pi ends the turn at once with `model_error`.
 */
const ALLOWANCE_REFUSAL =
  "mechane refused the dispatch: the workspace's allowance or the mech's cap cannot cover it today (quota exceeded)";

/**
 * The allowance refused a dispatch, which its turn records first. pi-ai's provider boundary takes only a rejected setup
 * and reads its message, whose `quota exceeded` stops pi's retry.
 */
class AllowanceExhausted extends Schema.TaggedError<AllowanceExhausted>()('AllowanceExhausted', {
  message: Schema.String,
}) {}

/** A dispatch's events once granted, or the refusal that ends it before anything is sent. */
type MeteredEvents = Result.Result<AsyncIterable<AssistantMessageEvent>, AllowanceExhausted>;

/** A granted dispatch to send at its output limit, for its end user, with the settle its events end in. */
type GrantedEventsInput = {
  readonly send: SendDispatch;
  readonly maxOutputTokens: number;
  readonly settle: (input: SettleInput) => Promise<void>;
  readonly endUserId: string;
};

/**
 * Reserves the dispatch, and sends it on a grant with at most the offer's output and with the grant's end user. A
 * refusal, already recorded on its turn or its drone, sends nothing. Every request comes with its conversation's
 * provider session id, which tells a drone's from its mech's, and with the signal that aborts it.
 */
export async function meteredEvents({
  piModel,
  context,
  offers,
  meter,
  requested,
  send,
}: MeteredEventsInput): Promise<MeteredEvents> {
  // pi asks only for a model the provider registered, one per offer.
  const offer = Option.getOrThrow(Array.findFirst(offers, (candidate) => candidate.id === piModel.id));
  const contextBytes = new TextEncoder().encode(JSON.stringify(context)).byteLength;
  // pi passes its stream options with every request, as the metered provider sets them.
  const { sessionId, signal, maxTokens } = Option.getOrThrow(requested);

  const reservation = await meter.reserve({
    offer,
    contextBytes,
    sessionId: Option.getOrThrow(Option.fromNullishOr(sessionId)),
    signal: Option.getOrThrow(Option.fromNullishOr(signal)),
  });

  const maxOutputTokens = Math.min(
    Option.getOrElse(Option.fromNullishOr(maxTokens), () => piModel.maxTokens),
    piModel.maxTokens,
  );

  const refused: () => MeteredEvents = () => Result.fail(new AllowanceExhausted({ message: ALLOWANCE_REFUSAL }));

  return Match.valueTags(reservation, {
    Granted: ({ settle, endUserId }) => grantedEvents({ send, maxOutputTokens, settle, endUserId }),
    Refused: refused,
  });
}

/** Sends a granted dispatch for its end user, and settles it once its events end. */
function grantedEvents({ send, maxOutputTokens, settle, endUserId }: GrantedEventsInput): MeteredEvents {
  const events = send({ maxTokens: maxOutputTokens, onPayload: (payload) => endUserPayload({ payload, endUserId }) });

  return Result.succeed(settledEvents({ events, settle }));
}
