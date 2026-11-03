import type { Api, AssistantMessageEvent, Model, StreamOptions, TranscriptContext } from '@earendil-works/pi-ai';
import type { ModelOffer } from '@mechane/deployment';
import { Array, DateTime, Duration, Match, Option, Result, Schema } from 'effect';
import { DISPATCH_DEADLINE } from '../constants.ts';
import { endUserPayload } from './end-user-payload.ts';
import { settledEvents } from './settled-events.ts';
import type { DispatchMeter, GrantedReservation, SendDispatch } from './types.ts';

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
  'mechane refused the dispatch: its allowance, dispatch limit, or deadline cannot cover it (quota exceeded)';

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
  readonly grant: GrantedReservation;
  readonly signal: AbortSignal;
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
  const contextJson = JSON.stringify(context);
  const contextBytes = new TextEncoder().encode(contextJson).byteLength;
  // pi passes its stream options with every request, as the metered provider sets them.
  const { sessionId, signal, maxTokens } = Option.getOrThrow(requested);
  const abortSignal = Option.getOrThrow(Option.fromNullishOr(signal));

  const reservation = await meter.reserve({
    offer,
    contextBytes,
    contextJson,
    sessionId: Option.getOrThrow(Option.fromNullishOr(sessionId)),
    signal: abortSignal,
  });

  const maxOutputTokens = Math.min(
    Option.getOrElse(Option.fromNullishOr(maxTokens), () => piModel.maxTokens),
    piModel.maxTokens,
  );

  const refused: () => MeteredEvents = () => Result.fail(new AllowanceExhausted({ message: ALLOWANCE_REFUSAL }));

  return Match.valueTags(reservation, {
    Granted: (grant) => grantedEvents({ send, maxOutputTokens, grant, signal: abortSignal }),
    Refused: refused,
  });
}

/** Sends a granted dispatch for its end user, and settles it once its events end. */
function grantedEvents({ send, maxOutputTokens, grant, signal }: GrantedEventsInput): MeteredEvents {
  const grantedLimit = Option.getOrElse(grant.maxOutputTokens, () => maxOutputTokens);
  const limit = Math.min(maxOutputTokens, grantedLimit);

  const deadlineSignal = Option.map(grant.deadlineAt, (at) => {
    const now = DateTime.nowUnsafe();
    const deadlineMs = DateTime.toEpochMillis(at);
    const nowMs = DateTime.toEpochMillis(now);
    const remainingMs = Math.max(0, deadlineMs - nowMs);
    const dispatchTimeoutMs = Duration.toMillis(DISPATCH_DEADLINE);
    const timeoutMs = Math.min(remainingMs, dispatchTimeoutMs);

    return AbortSignal.timeout(timeoutMs);
  });

  const signals = [signal, ...Option.toArray(deadlineSignal)];
  const dispatchSignal = AbortSignal.any(signals);

  const events = send({
    maxTokens: limit,
    signal: dispatchSignal,
    onPayload: async (payload) => {
      const request = endUserPayload({ payload, endUserId: grant.endUserId });
      const requestJson = JSON.stringify(request);
      const recorded = await grant.recordRequest({ requestJson });

      if (!recorded.isAllowed) {
        const exhausted = new AllowanceExhausted({ message: ALLOWANCE_REFUSAL });
        const refused = Result.fail(exhausted);

        return Result.getOrThrow(refused);
      }

      return request;
    },
  });

  const settled = settledEvents({ events, settle: grant.settle });

  return Result.succeed(settled);
}
