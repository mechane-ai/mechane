import type { LanguageModelV4CallOptions, LanguageModelV4Usage } from '@ai-sdk/provider';
import type { ModelOffer } from '../config.ts';
import type { ModelUsage } from '../domain.ts';

const TOKENS_PER_MILLION = 1_000_000n;
const PROMPT_OVERHEAD_TOKENS = 4096;

type BoundInput = { readonly offer: ModelOffer; readonly options: LanguageModelV4CallOptions };

type PricedUsage = { readonly micros: number; readonly usage: ModelUsage };
type PriceInput = { readonly offer: ModelOffer; readonly usage: LanguageModelV4Usage };
type Charge = { readonly tokens: number; readonly rate: number };

export function boundModelSpend({ offer, options }: BoundInput): number {
  const prompt = JSON.stringify({
    prompt: options.prompt,
    tools: options.tools,
    responseFormat: options.responseFormat,
  });

  const promptBytes = new TextEncoder().encode(prompt).byteLength;
  const inputTokens = Math.min(promptBytes + PROMPT_OVERHEAD_TOKENS, offer.contextWindowTokens);
  const outputTokens = Math.min(options.maxOutputTokens ?? offer.maxOutputTokens, offer.maxOutputTokens);

  const inputRate = Math.max(
    offer.inputMicrosPerMillionTokens,
    offer.cacheReadMicrosPerMillionTokens,
    offer.cacheWriteMicrosPerMillionTokens,
  );

  return priceCharges([
    { tokens: inputTokens, rate: inputRate },
    { tokens: outputTokens, rate: offer.outputMicrosPerMillionTokens },
  ]);
}

export function priceModelUsage({ offer, usage }: PriceInput): PricedUsage | null {
  const inputTokens = usage.inputTokens.total;
  const outputTokens = usage.outputTokens.total;
  const cacheReadTokens = usage.inputTokens.cacheRead ?? 0;
  const cacheWriteTokens = usage.inputTokens.cacheWrite ?? 0;

  if (inputTokens === undefined || outputTokens === undefined) {
    return null;
  }

  if (!isTokenCount(inputTokens) || !isTokenCount(outputTokens)) {
    return null;
  }

  if (!isTokenCount(cacheReadTokens) || !isTokenCount(cacheWriteTokens)) {
    return null;
  }

  if (cacheReadTokens + cacheWriteTokens > inputTokens) {
    return null;
  }

  const uncachedTokens = inputTokens - cacheReadTokens - cacheWriteTokens;

  const micros = priceCharges([
    { tokens: uncachedTokens, rate: offer.inputMicrosPerMillionTokens },
    { tokens: cacheReadTokens, rate: offer.cacheReadMicrosPerMillionTokens },
    { tokens: cacheWriteTokens, rate: offer.cacheWriteMicrosPerMillionTokens },
    { tokens: outputTokens, rate: offer.outputMicrosPerMillionTokens },
  ]);

  return { micros, usage: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } };
}

function isTokenCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function priceCharges(charges: ReadonlyArray<Charge>): number {
  const total = charges.reduce((sum, charge) => sum + BigInt(charge.tokens) * BigInt(charge.rate), 0n);
  const rounded = (total + TOKENS_PER_MILLION - 1n) / TOKENS_PER_MILLION;
  const micros = Number(rounded);

  if (!Number.isSafeInteger(micros)) {
    throw new TypeError('The model price exceeds the supported accounting range');
  }

  return micros;
}
