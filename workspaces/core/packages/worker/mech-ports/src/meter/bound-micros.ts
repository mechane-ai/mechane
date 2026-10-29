import type { ModelOffer } from '@mechane/deployment';
import type { Micros } from '@mechane/records';
import { priceMicros } from './price-micros.ts';

/** The tokens a request's framing may add beyond the bytes of its context, which its input bound counts. */
const PROMPT_OVERHEAD_TOKENS = 4096;

type BoundMicrosInput = { readonly offer: ModelOffer; readonly contextBytes: number };

/**
 * The most a dispatch can cost. Its input is its context's bytes, each at most one token, with the framing's overhead
 * and never beyond the window, at the highest input rate. Its output is the offer's whole output at the output rate.
 */
export function boundMicros({ offer, contextBytes }: BoundMicrosInput): Micros {
  return priceMicros({
    charges: [
      {
        tokens: Math.min(contextBytes + PROMPT_OVERHEAD_TOKENS, offer.contextWindowTokens),
        microsPerMillionTokens: Math.max(
          offer.inputMicrosPerMillionTokens,
          offer.cacheReadMicrosPerMillionTokens,
          offer.cacheWriteMicrosPerMillionTokens,
        ),
      },
      { tokens: offer.maxOutputTokens, microsPerMillionTokens: offer.outputMicrosPerMillionTokens },
    ],
  });
}
