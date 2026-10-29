import type {
  Api,
  AssistantMessageEvent,
  AssistantMessageEventStream,
  Model,
  ProviderStreams,
  StreamOptions,
  TranscriptContext,
} from '@earendil-works/pi-ai';
import { lazyStream } from '@earendil-works/pi-ai/api/lazy';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import type { ModelOffer } from '@mechane/deployment';
import { Option, Result } from 'effect';
import { meteredEvents } from './metered-events.ts';
import type { DispatchMeter, SendDispatch } from './types.ts';

type MeteredApiInput = { readonly offers: ReadonlyArray<ModelOffer>; readonly meter: DispatchMeter };

/** A request pi sends through the metered API, the options it sent, and the send its grant leads to. */
type MeteredStreamInput = {
  readonly piModel: Model<Api>;
  readonly context: TranscriptContext;
  /** The options pi sent with the request, which it always sends. */
  readonly requested: Option.Option<StreamOptions>;
  readonly offers: ReadonlyArray<ModelOffer>;
  readonly meter: DispatchMeter;
  readonly send: SendDispatch;
};

/**
 * The chat-completions API with every request metered and sent with no retry of its own, since pi's durable retry is
 * the one retry owner.
 */
export function meteredApi({ offers, meter }: MeteredApiInput): ProviderStreams {
  const completions = openAICompletionsApi();

  const stream: ProviderStreams['stream'] = (piModel, context, options) => {
    const send: SendDispatch = (added) => completions.stream(piModel, context, { ...options, maxRetries: 0, ...added });

    return meteredStream({ piModel, context, requested: Option.fromNullishOr(options), offers, meter, send });
  };

  const streamSimple: ProviderStreams['streamSimple'] = (piModel, context, options) => {
    const send: SendDispatch = (added) =>
      completions.streamSimple(piModel, context, { ...options, maxRetries: 0, ...added });

    return meteredStream({ piModel, context, requested: Option.fromNullishOr(options), offers, meter, send });
  };

  return { stream, streamSimple };
}

/**
 * A metered dispatch as pi-ai's lazy stream. Its setup rejects with the allowance's refusal, since pi-ai's provider
 * boundary reads only a rejected setup's message.
 */
function meteredStream({ piModel, ...dispatch }: MeteredStreamInput): AssistantMessageEventStream {
  const setup: () => Promise<AsyncIterable<AssistantMessageEvent>> = async () =>
    Result.getOrThrow(await meteredEvents({ piModel, ...dispatch }));

  return lazyStream(piModel, setup);
}
