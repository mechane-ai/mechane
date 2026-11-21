import type { Api, Model, ProviderStreams } from '@earendil-works/pi-ai';
import { createModels, createProvider } from '@earendil-works/pi-ai/models';
import { Schema } from 'effect';
import { gatewayBase } from './gateway-address.ts';
import type { ModelGatewayConfiguration, ModelOffer } from './offers.ts';

export const MODEL_GATEWAY_AUTH_MARKER = 'managed-transport-credential';

const tokensPerMillion = 1_000_000n;
const microsPerDollar = 1_000_000;
const sseDataPrefix = 'data:';
const maximumSseLineBytes = 2_097_152;

const UsageTokenCount = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }));

const UsageDetails = Schema.Struct({
  cached_tokens: Schema.optionalKey(UsageTokenCount),
  cache_write_tokens: Schema.optionalKey(UsageTokenCount),
  cache_write_1h_tokens: Schema.optionalKey(UsageTokenCount),
  cache_write_5m_tokens: Schema.optionalKey(UsageTokenCount),
});

function writesAccounted(details: typeof UsageDetails.Type | undefined): boolean {
  const written = details?.cache_write_tokens ?? 0;

  return (details?.cache_write_1h_tokens ?? 0) + (details?.cache_write_5m_tokens ?? 0) <= written;
}

const ServerToolUse = Schema.Struct({
  web_search_requests: Schema.optionalKey(UsageTokenCount),
  web_fetch_requests: Schema.optionalKey(UsageTokenCount),
});

export const RawUsage = Schema.Struct({
  prompt_tokens: UsageTokenCount,
  completion_tokens: UsageTokenCount,
  speed: Schema.optionalKey(Schema.Literals(['standard', 'fast'])),
  prompt_tokens_details: Schema.optionalKey(Schema.UndefinedOr(UsageDetails)),
  server_tool_use: Schema.optionalKey(Schema.UndefinedOr(ServerToolUse)),
}).check(
  Schema.makeFilter(
    (usage) =>
      (usage.prompt_tokens_details?.cached_tokens ?? 0) + (usage.prompt_tokens_details?.cache_write_tokens ?? 0) <=
      usage.prompt_tokens,
  ),
  Schema.makeFilter((usage) => writesAccounted(usage.prompt_tokens_details)),
);

export type RawUsage = typeof RawUsage.Type;

const decodeUsage = Schema.decodeUnknownSync(RawUsage);

function flatTokenCost(offer: NonNullable<ModelOffer['listPrice']>, usage: RawUsage): bigint {
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const written = usage.prompt_tokens_details?.cache_write_tokens ?? 0;
  const uncached = Math.max(0, usage.prompt_tokens - cached - written);

  const total =
    BigInt(uncached) * BigInt(offer.inputMicrosPerMillionTokens) +
    BigInt(cached) * BigInt(offer.cacheReadMicrosPerMillionTokens) +
    BigInt(written) * BigInt(offer.cacheWriteMicrosPerMillionTokens) +
    BigInt(usage.completion_tokens) * BigInt(offer.outputMicrosPerMillionTokens);

  return total;
}

function tokenCost(rates: NonNullable<ModelOffer['listPrice']>, usage: RawUsage): bigint | null {
  const base = flatTokenCost(rates, usage);
  const oneHourRate = rates.cacheWriteOneHourMicrosPerMillionTokens ?? rates.cacheWriteMicrosPerMillionTokens;

  if (oneHourRate === rates.cacheWriteMicrosPerMillionTokens) {
    return base;
  }

  const writes = usage.prompt_tokens_details;
  const oneHourWrites = writes?.cache_write_1h_tokens ?? 0;

  if (oneHourWrites + (writes?.cache_write_5m_tokens ?? 0) !== (writes?.cache_write_tokens ?? 0)) {
    return null;
  }

  const adjustment = BigInt(oneHourWrites) * (BigInt(oneHourRate) - BigInt(rates.cacheWriteMicrosPerMillionTokens));

  return base + adjustment;
}

export function sessionListCost(offer: ModelOffer, usage: RawUsage): string | null {
  if (offer.listPrice === undefined) {
    return null;
  }

  return tokenCost(offer.listPrice, usage)?.toString() ?? null;
}

export function charge(offer: ModelOffer, usage: RawUsage | null): number | null {
  if (usage === null) {
    return null;
  }

  const total = tokenCost(offer, usage);

  if (total === null) {
    return null;
  }

  return Number((total + tokensPerMillion - 1n) / tokensPerMillion);
}

export function reservation(offer: ModelOffer): number {
  const rate = Math.max(
    offer.inputMicrosPerMillionTokens,
    offer.cacheReadMicrosPerMillionTokens,
    offer.cacheWriteMicrosPerMillionTokens,
    offer.cacheWriteOneHourMicrosPerMillionTokens ?? 0,
  );

  const total =
    BigInt(offer.contextWindowTokens) * BigInt(rate) +
    BigInt(offer.maxOutputTokens) * BigInt(offer.outputMicrosPerMillionTokens);

  return Number((total + tokensPerMillion - 1n) / tokensPerMillion);
}

type UsageObservers = {
  readonly response: Response;
  readonly recordUsage: (usage: RawUsage) => void;
  readonly recordError?: (error: unknown) => void;
  readonly verifyChunk?: (chunk: unknown) => void;
};

export function usageTransport({ response, recordUsage, recordError, verifyChunk }: UsageObservers): Response {
  return observeGatewayEvents(response, (parsed) => {
    verifyChunk?.(parsed);

    if (typeof parsed !== 'object' || parsed === null) {
      return;
    }

    if ('error' in parsed) {
      recordError?.(parsed.error);
    }

    if ('usage' in parsed && Schema.is(RawUsage)(parsed.usage)) {
      recordUsage(decodeUsage(parsed.usage));
    }
  });
}

export function observeGatewayEvents(response: Response, onEvent: (event: unknown) => void): Response {
  if (response.body === null) {
    return response;
  }

  const decoder = new TextDecoder();
  const pending = { text: '' };

  const body = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        pending.text += decoder.decode(chunk, { stream: true });

        if (pending.text.length > maximumSseLineBytes) {
          throw new Error('The model SSE line exceeds the transport limit');
        }

        const lines = pending.text.split('\n');
        pending.text = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith(sseDataPrefix)) {
            const payloadText = line.slice(sseDataPrefix.length).trim();

            if (payloadText !== '[DONE]' && payloadText.length > 0) {
              const parsed: unknown = JSON.parse(payloadText);

              onEvent(parsed);
            }
          }
        }

        controller.enqueue(chunk);
      },
    }),
  );

  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

export function gatewayModelRegistry(
  configuration: ModelGatewayConfiguration,
  api: ProviderStreams,
  offers: ReadonlyArray<ModelOffer>,
) {
  const models = createModels();

  const definitions: Array<Model<Api>> = offers.map((offer) => {
    const input: Model<'openai-completions'>['input'] = ['text'];

    if (offer.supportsImages === true) {
      input.push('image');
    }

    return {
      id: offer.id,
      name: offer.id,
      api: offer.protocol ?? 'openai-completions',
      provider: 'mechane',
      baseUrl: gatewayBase(configuration, offer.protocol),
      reasoning: (offer.efforts?.length ?? 0) > 0,
      input,
      contextWindow: offer.contextWindowTokens,
      maxTokens: offer.maxOutputTokens,
      cost: {
        input: offer.inputMicrosPerMillionTokens / microsPerDollar,
        output: offer.outputMicrosPerMillionTokens / microsPerDollar,
        cacheRead: offer.cacheReadMicrosPerMillionTokens / microsPerDollar,
        cacheWrite: offer.cacheWriteMicrosPerMillionTokens / microsPerDollar,
      },
    };
  });

  models.setProvider(
    createProvider({
      id: 'mechane',
      baseUrl: configuration.model.upstreamUrl,
      auth: {
        apiKey: {
          name: 'Configured model gateway',
          resolve: async () => ({ auth: { apiKey: MODEL_GATEWAY_AUTH_MARKER } }),
        },
      },
      models: definitions,
      api,
    }),
  );

  return models;
}
