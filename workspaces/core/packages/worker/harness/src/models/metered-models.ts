import type { ApiKeyAuth, Model, Models } from '@earendil-works/pi-ai';
import { createModels, createProvider } from '@earendil-works/pi-ai/models';
import type { ModelOffer } from '@mechane/deployment';
import { Redacted } from 'effect';
import { MODEL_PROVIDER } from '../constants.ts';
import type { ModelUpstream } from '../types.ts';
import { meteredApi } from './metered-api.ts';
import type { DispatchMeter } from './types.ts';

type MeteredModelsInput = { readonly modelUpstream: ModelUpstream; readonly meter: DispatchMeter };

/** The name pi-ai shows for the model upstream's key, which reaches pi-ai only through its auth resolution. */
const UPSTREAM_KEY_NAME = 'Mechane model upstream key';

/** Micro-dollars in a dollar; pi-ai prices tokens in dollars per million, which offers write in micro-dollars. */
const MICROS_PER_DOLLAR = 1_000_000;

type OfferModelInput = { readonly offer: ModelOffer; readonly upstream: URL };

/**
 * Models with one pi-ai provider over the deployment's model upstream, whose every request is a metered dispatch. Since
 * pi stores its stream settings in every request's checkpoint, the upstream's key goes only through auth.
 */
export function meteredModels({ modelUpstream, meter }: MeteredModelsInput): Models {
  const { upstream, apiKey, offers } = modelUpstream;
  const models = createModels();

  const resolveKey: ApiKeyAuth['resolve'] = async () => {
    const key = await apiKey();

    return { auth: { apiKey: Redacted.value(key) } };
  };

  models.setProvider(
    createProvider({
      id: MODEL_PROVIDER,
      auth: { apiKey: { name: UPSTREAM_KEY_NAME, resolve: resolveKey } },
      models: offers.map((offer) => offerModel({ offer, upstream })),
      api: meteredApi({ offers, meter }),
    }),
  );

  return models;
}

/**
 * An offer as a pi-ai model; without reasoning, pi-ai keeps the `system` role for the instructions. Every request names
 * its conversation's provider session in OpenRouter's `x-session-id` header, as pi-ai does for OpenRouter's own URL. An
 * upstream then keeps each conversation's cache apart, and a fork's never mixes with its parent's.
 */
function offerModel({ offer, upstream }: OfferModelInput): Model<'openai-completions'> {
  return {
    id: offer.id,
    name: offer.id,
    api: 'openai-completions',
    provider: MODEL_PROVIDER,
    baseUrl: upstream.href,
    input: ['text'],
    reasoning: false,
    compat: { sendSessionAffinityHeaders: true, sessionAffinityFormat: 'openrouter' },
    contextWindow: offer.contextWindowTokens,
    maxTokens: offer.maxOutputTokens,
    cost: {
      input: offer.inputMicrosPerMillionTokens / MICROS_PER_DOLLAR,
      output: offer.outputMicrosPerMillionTokens / MICROS_PER_DOLLAR,
      cacheRead: offer.cacheReadMicrosPerMillionTokens / MICROS_PER_DOLLAR,
      cacheWrite: offer.cacheWriteMicrosPerMillionTokens / MICROS_PER_DOLLAR,
    },
  };
}
