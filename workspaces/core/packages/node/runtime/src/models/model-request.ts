import type {
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4ResponseMetadata,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  LanguageModelV4Usage,
} from '@ai-sdk/provider';
import { APICallError } from '@ai-sdk/provider';
import { FatalError } from 'workflow';
import { reserveModelRequest, settleModelRequest } from './model-meter.ts';
import type { ModelRequest } from './model-meter.ts';
import { prepareModel } from './model-provider.ts';
import type { ModelReference } from './model-reference.ts';

type RequestInput = { readonly reference: ModelReference; readonly options: LanguageModelV4CallOptions };

type MeteredStreamInput = {
  readonly source: ReadableStream<LanguageModelV4StreamPart>;
  readonly request: ModelRequest;
};

export async function executeModelGenerate({
  reference,
  options,
}: RequestInput): Promise<LanguageModelV4GenerateResult> {
  'use step';

  const prepared = prepareModel({ reference, options });
  const request = await reserveModelRequest({ reference, options: prepared.options, offer: prepared.offer });
  const generation = Promise.resolve(prepared.model.doGenerate(prepared.options));

  const result = await generation.catch(async (error: unknown) => {
    await settleModelRequest({ request, usage: null });

    throw modelFailure(error);
  });

  await settleModelRequest({ request, usage: result.usage });

  const answer: LanguageModelV4GenerateResult = {
    content: result.content,
    finishReason: result.finishReason,
    usage: numericUsage(result.usage),
    warnings: result.warnings,
  };

  if (result.providerMetadata !== undefined) {
    answer.providerMetadata = result.providerMetadata;
  }

  if (result.structuredOutputText !== undefined) {
    answer.structuredOutputText = result.structuredOutputText;
  }

  if (result.response !== undefined) {
    answer.response = responseMetadata(result.response);
  }

  return answer;
}

export async function executeModelStream({ reference, options }: RequestInput): Promise<LanguageModelV4StreamResult> {
  'use step';

  const prepared = prepareModel({ reference, options });
  const request = await reserveModelRequest({ reference, options: prepared.options, offer: prepared.offer });

  try {
    const result = await prepared.model.doStream(prepared.options);

    return { stream: meteredStream({ source: result.stream, request }) };
  } catch (error) {
    await settleModelRequest({ request, usage: null });

    throw modelFailure(error);
  }
}

function meteredStream({ source, request }: MeteredStreamInput): ReadableStream<LanguageModelV4StreamPart> {
  const reader = source.getReader();
  const state = { hasFinished: false };

  return new ReadableStream<LanguageModelV4StreamPart>({
    async pull(controller) {
      try {
        const next = await reader.read();

        if (next.done) {
          if (!state.hasFinished) {
            throw new FatalError('The model response ended without confirmed usage');
          }

          reader.releaseLock();
          controller.close();

          return;
        }

        const part = next.value;

        if (part.type === 'error') {
          throw modelFailure(part.error);
        }

        if (part.type === 'raw') {
          return;
        }

        if (part.type === 'finish') {
          state.hasFinished = true;

          await settleModelRequest({ request, usage: part.usage });
          controller.enqueue({ ...part, usage: numericUsage(part.usage) });

          return;
        }

        controller.enqueue(part);
      } catch (error) {
        const cleanup = [reader.cancel()];

        if (!state.hasFinished) {
          cleanup.push(settleModelRequest({ request, usage: null }));
        }

        await Promise.allSettled(cleanup);
        reader.releaseLock();
        controller.error(modelFailure(error));
      }
    },
    async cancel() {
      const cleanup = [reader.cancel()];

      if (!state.hasFinished) {
        cleanup.push(settleModelRequest({ request, usage: null }));
      }

      const results = await Promise.allSettled(cleanup);

      reader.releaseLock();

      if (results.some((result) => result.status === 'rejected')) {
        throw new FatalError('The model stream could not close cleanly; its reserved spend remains accounted for');
      }
    },
  });
}

function numericUsage(usage: LanguageModelV4Usage): LanguageModelV4Usage {
  return { inputTokens: { ...usage.inputTokens }, outputTokens: { ...usage.outputTokens } };
}

function responseMetadata(response: LanguageModelV4ResponseMetadata): LanguageModelV4ResponseMetadata {
  const metadata: LanguageModelV4ResponseMetadata = {};

  if (response.id !== undefined) {
    metadata.id = response.id;
  }

  if (response.timestamp !== undefined) {
    metadata.timestamp = response.timestamp;
  }

  if (response.modelId !== undefined) {
    metadata.modelId = response.modelId;
  }

  return metadata;
}

function modelFailure(error: unknown): FatalError {
  if (error instanceof FatalError) {
    return error;
  }

  // Provider error messages may contain request bodies; only their status crosses the durable boundary.
  if (APICallError.isInstance(error) && error.statusCode !== undefined) {
    return new FatalError(
      `The model provider returned HTTP ${error.statusCode}; its reserved spend remains accounted for`,
    );
  }

  return new FatalError('The model request failed; its reserved spend remains accounted for');
}
