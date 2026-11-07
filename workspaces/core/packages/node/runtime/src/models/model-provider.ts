import type { LanguageModelV4, LanguageModelV4CallOptions } from '@ai-sdk/provider';
import { HttpHeader } from '@mechane/records';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { Redacted } from 'effect';
import { FatalError } from 'workflow';
import { loadRuntimeConfiguration } from '../config.ts';
import type { ModelOffer } from '../config.ts';
import type { ModelReference } from './model-reference.ts';

type PreparedModel = {
  readonly model: LanguageModelV4;
  readonly offer: ModelOffer;
  readonly options: LanguageModelV4CallOptions;
};

type PrepareInput = { readonly reference: ModelReference; readonly options: LanguageModelV4CallOptions };

const MODEL_TIMEOUT_MS = 180_000;

export function prepareModel({ reference, options }: PrepareInput): PreparedModel {
  const configuration = loadRuntimeConfiguration();
  const offer = configuration.model.offers.find((candidate) => candidate.id === reference.modelId);

  if (offer === undefined) {
    throw new FatalError('The selected model is not available in this installation');
  }

  const provider = createOpenRouter({
    baseURL: configuration.model.upstreamUrl,
    apiKey: Redacted.value(configuration.model.apiKey),
    compatibility: 'strict',
    headers: { [HttpHeader.XSessionId]: reference.sessionId },
  });

  const timeout = AbortSignal.timeout(MODEL_TIMEOUT_MS);
  const signals = [timeout];

  if (options.abortSignal !== undefined) {
    signals.push(options.abortSignal);
  }

  const prepared: LanguageModelV4CallOptions = {
    ...options,
    maxOutputTokens: Math.min(options.maxOutputTokens ?? offer.maxOutputTokens, offer.maxOutputTokens),
    abortSignal: AbortSignal.any(signals),
    includeRawChunks: false,
    headers: { [HttpHeader.XSessionId]: reference.sessionId },
  };

  if (reference.modelId.startsWith('anthropic/')) {
    const model = provider.chat(reference.modelId, { cache_control: { type: 'ephemeral' } });

    return { model, offer, options: prepared };
  }

  return { model: provider.chat(reference.modelId), offer, options: prepared };
}
