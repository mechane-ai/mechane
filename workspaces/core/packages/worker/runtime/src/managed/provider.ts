import type {
  Api,
  AssistantMessage,
  AssistantMessageEvent,
  Model,
  ProviderStreams,
  SimpleStreamOptions,
  StreamOptions,
  TranscriptContext,
} from '@earendil-works/pi-ai';
import { stream, streamSimple } from '@earendil-works/pi-ai/api/openai-completions';
import { hasApi } from '@earendil-works/pi-ai/models';
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai/utils/event-stream';
import type { AssistantMessageEventStream } from '@earendil-works/pi-ai/utils/event-stream';
import { isContextOverflow } from '@earendil-works/pi-ai/utils/overflow';
import { isRetryableAssistantError } from '@earendil-works/pi-ai/utils/retry';
import { HttpStatusCode } from '@mechane/records';
import { Struct } from 'effect';
import type { ModelOffer } from '../config.ts';
import { gatewayModelRegistry, MODEL_GATEWAY_AUTH_MARKER } from '../models/gateway.ts';
import { managedModelDefinitions, resolveManagedModel } from '../models/managed-offers.ts';
import { assertManagedModelOptions } from '../models/managed-options.ts';
import { supportsManagedSystemMessages } from '../models/managed-system-message.ts';
import type { ManagedModelOptions } from '../models/model-effort.ts';
import { failManagedRequest, ManagedRuntimeError } from './failure.ts';
import { streamManagedAnthropic } from './provider-anthropic.ts';
import { MANAGED_MODEL_TIMEOUT_MS, managedAttempt } from './provider-attempt.ts';
import { prepareManagedDocuments, UnsupportedManagedImages } from './provider-documents.ts';
import type { ManagedProviderOwner, ManagedRequest } from './provider-types.ts';

type Invocation = {
  readonly model: Model<Api>;
  readonly transcript: TranscriptContext;
  readonly options?: SimpleStreamOptions | StreamOptions | undefined;
  readonly isSimple: boolean;
};

function failure(model: Model<Api>, reason: string): AssistantMessage {
  return {
    role: 'assistant',
    api: model.api,
    provider: model.provider,
    model: model.id,
    timestamp: Date.now(),
    stopReason: 'error',
    errorMessage: reason,
    content: [],
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
}

type PublishEvent = (event: AssistantMessageEvent) => void;

type NativeStream = {
  readonly input: Invocation;
  readonly transcript: TranscriptContext;
  readonly offer: ModelOffer;
  readonly settings: StreamOptions;
  readonly modelOptions: ManagedModelOptions;
};

function selectOffer(offer: ModelOffer, options: ManagedModelOptions): ModelOffer {
  assertManagedModelOptions(offer, options);

  if (options.speed !== 'fast' || offer.fastPricing === undefined) {
    return offer;
  }

  // Fast pricing is independent of standard pricing, including absence of a known list price.
  return { ...Struct.omit(offer, ['listPrice', 'cacheWriteOneHourMicrosPerMillionTokens']), ...offer.fastPricing };
}

function nativeStream({ input, transcript, offer, settings, modelOptions }: NativeStream): AssistantMessageEventStream {
  if (hasApi(input.model, 'anthropic-messages')) {
    return streamManagedAnthropic({
      model: { ...input.model, id: offer.id },
      transcript,
      settings,
      isSimple: input.isSimple,
      modelOptions,
    });
  }

  if (!hasApi(input.model, 'openai-completions')) {
    throw new Error('The model protocol is unavailable at the configured gateway');
  }

  const model = {
    ...input.model,
    id: offer.id,
    compat: { ...input.model.compat, supportsMidConvoSystemMessages: supportsManagedSystemMessages(offer.id) },
  };

  if (modelOptions.effort !== undefined) {
    return stream(model, transcript, { ...settings, reasoningEffort: modelOptions.effort });
  }

  if (input.isSimple) {
    return streamSimple(model, transcript, settings);
  }

  return stream(model, transcript, settings);
}

async function run(owner: ManagedRequest, input: Invocation, publish: PublishEvent): Promise<void> {
  const execution = await owner.current();
  const entry = resolveManagedModel(owner.configuration.model.offers, execution.model);

  if (entry === undefined || (entry.protocol ?? 'openai-completions') !== input.model.api) {
    failManagedRequest(HttpStatusCode.BadRequest, 'The selected model has no configured model gateway');
  }

  if (input.model.id !== execution.model || input.options?.sessionId !== execution.providerSessionId) {
    throw new Error('The agent no longer owns this model request');
  }

  const offer = selectOffer(entry, execution);
  const attempt = managedAttempt({ owner, execution, offer, signal: input.options.signal });
  let transcript = input.transcript;

  if (input.options.onPayload === undefined && owner.hydrateCompaction !== undefined) {
    transcript = await owner.hydrateCompaction({ transcript, providerSessionId: execution.providerSessionId });
  }

  const documents = prepareManagedDocuments(transcript, input.options.onPayload, offer);

  const payload: Pick<StreamOptions, 'onPayload'> = {};

  if (documents.onPayload !== undefined) {
    payload.onPayload = documents.onPayload;
  }

  const settings = {
    ...input.options,
    ...payload,
    apiKey: MODEL_GATEWAY_AUTH_MARKER,
    fetch: attempt.fetch,
    maxRetries: 0,
    timeoutMs: MANAGED_MODEL_TIMEOUT_MS,
    maxTokens: Math.min(input.options.maxTokens ?? offer.maxOutputTokens, offer.maxOutputTokens),
    transport: 'sse' as const,
  };

  const upstream = nativeStream({ input, transcript: documents.transcript, offer, settings, modelOptions: execution });

  try {
    for await (const event of upstream) {
      if (event.type === 'error') {
        await attempt.finish();

        const message = {
          ...failure(input.model, safeFailureReason(attempt.reason(), event.error, offer.contextWindowTokens)),
          stopReason: event.reason,
        };

        publish({ type: 'error', reason: event.reason, error: message });

        return;
      }

      if (event.type === 'done') {
        if (!attempt.measured()) {
          await attempt.finish();

          const message = failure(input.model, 'The model provider did not return usage for this completion');

          publish({ type: 'error', reason: 'error', error: message });

          return;
        }

        const message = { ...event.message, model: input.model.id };

        await attempt.finish(message);
        publish({ ...event, message });

        return;
      }

      publish({ ...event, partial: { ...event.partial, model: input.model.id } });
    }

    throw new Error('The upstream stream ended without a terminal event');
  } finally {
    await attempt.finish();
  }
}

function safeFailureReason(refusal: string | undefined, error: AssistantMessage, contextWindowTokens: number): string {
  if (refusal !== undefined) {
    return refusal;
  }

  if (isContextOverflow(error, contextWindowTokens)) {
    return 'context_length_exceeded';
  }

  if (isRetryableAssistantError(error)) {
    return 'The model provider service is temporarily unavailable';
  }

  return 'The model provider rejected the request';
}

export function createManagedModels(owner: ManagedProviderOwner) {
  const { configuration } = owner;

  function request(input: Invocation): AssistantMessageEventStream {
    const output = createAssistantMessageEventStream();

    async function runGated(): Promise<void> {
      const providerSessionId = input.options?.sessionId;

      if (providerSessionId === undefined) {
        throw new Error('Missing Pi provider session');
      }

      await owner.withRequest(
        providerSessionId,
        input.options?.signal,
        async (current) => await run({ ...owner, current }, input, (event) => output.push(event)),
      );
    }

    void runGated()
      .catch((error: unknown) => {
        let reason = 'Managed model execution stopped without a confirmed completion';

        if (error instanceof ManagedRuntimeError) {
          reason = 'The pinned model settings are unavailable at the configured gateway';
        } else if (error instanceof UnsupportedManagedImages) {
          reason = 'The selected model does not accept image input';
        }

        const message = failure(input.model, reason);

        output.push({ type: 'error', reason: 'error', error: message });
      })
      .finally(() => output.end());

    return output;
  }

  const api: ProviderStreams = {
    stream: (model, transcript, options) => request({ model, transcript, options, isSimple: false }),
    streamSimple: (model, transcript, options) => request({ model, transcript, options, isSimple: true }),
  };

  return gatewayModelRegistry(configuration, api, managedModelDefinitions(configuration.model.offers));
}
