import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type {
  Api,
  AssistantMessage,
  Model,
  ProviderStreams,
  SimpleStreamOptions,
  StreamOptions,
  TranscriptContext,
} from '@earendil-works/pi-ai';
import { stream, streamSimple } from '@earendil-works/pi-ai/api/openai-completions';
import { createModels, createProvider, hasApi } from '@earendil-works/pi-ai/models';
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai/utils/event-stream';
import { isContextOverflow } from '@earendil-works/pi-ai/utils/overflow';
import { isRetryableAssistantError } from '@earendil-works/pi-ai/utils/retry';
import { LiveDoc } from '@earendil-works/pi-durable';
import type { SubmissionId, Tx } from '@earendil-works/pi-durable';
import { ProviderDispatchRefused } from '@mechane/control-store';
import { Redacted, Schema } from 'effect';
import { Attempts, putAttempt, Turns } from '../actor/collections.ts';
import type { AttemptRecord, TurnRecord } from '../actor/record-schemas.ts';
import { decodeStored, RunRecord } from '../actor/records.ts';
import { fingerprint, State } from '../actor/state.ts';
import type { ActorAccess } from '../actor/types.ts';
import type { ModelOffer, RuntimeConfiguration } from '../config.ts';
import { notificationsForInputs, turnForNativeInputs } from '../notifications/admission.ts';
import { rejectRedirect } from '../tools/http.ts';
import {
  createProviderDiagnostic,
  formatProviderFailure,
  observeProviderError,
  observeProviderResponse,
} from './provider-diagnostic.ts';
import type { ProviderDiagnosticCapture } from './provider-diagnostic.ts';

const tokensPerMillion = 1_000_000n;
const microsPerDollar = 1_000_000;
const sseDataPrefix = 'data:';
const allowanceRefusals: ReadonlySet<string> = new Set(['workspace_allowance', 'mech_allowance']);
const terminalEvents: ReadonlySet<string> = new Set(['done', 'error']);
const requestTimeoutMs = 180_000;
const maximumSseLineBytes = 2_097_152;

const UsageTokenCount = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }));

const UsageDetails = Schema.Struct({
  cached_tokens: Schema.optionalKey(UsageTokenCount),
  cache_write_tokens: Schema.optionalKey(UsageTokenCount),
});

const RawUsage = Schema.Struct({
  prompt_tokens: UsageTokenCount,
  completion_tokens: UsageTokenCount,
  prompt_tokens_details: Schema.optionalKey(Schema.UndefinedOr(UsageDetails)),
}).check(
  Schema.makeFilter(
    (usage) =>
      (usage.prompt_tokens_details?.cached_tokens ?? 0) + (usage.prompt_tokens_details?.cache_write_tokens ?? 0) <=
      usage.prompt_tokens,
  ),
);

type RawUsage = typeof RawUsage.Type;

type ProviderRequestInput = {
  readonly model: Model<Api>;
  readonly transcript: TranscriptContext;
  readonly options: StreamOptions | SimpleStreamOptions | undefined;
  readonly isSimple: boolean;
};

function sanitizedFailure(input: {
  readonly message: AssistantMessage;
  readonly model: Model<Api>;
  readonly contextWindowTokens: number;
  readonly refusal: string | null;
  readonly capture: ProviderDiagnosticCapture;
}): AssistantMessage {
  const diagnostic = { text: 'The model provider rejected the request' };

  if (isRetryableAssistantError(input.message)) {
    diagnostic.text = 'The model provider service is temporarily unavailable';
  }

  if (isContextOverflow(input.message, input.contextWindowTokens)) {
    diagnostic.text = 'context_length_exceeded';
  }

  if (input.refusal !== null) {
    diagnostic.text = `Mech model admission stopped: ${input.refusal}`;

    if (allowanceRefusals.has(input.refusal)) {
      diagnostic.text = `Mech model admission is out of budget: ${input.refusal}`;
    }
  }

  return {
    role: 'assistant',
    api: input.model.api,
    provider: input.model.provider,
    model: input.model.id,
    content: [],
    stopReason: input.message.stopReason,
    errorMessage: formatProviderFailure({
      summary: diagnostic.text,
      capture: input.capture,
      responseId: input.message.responseId,
    }),
    timestamp: input.message.timestamp,
    usage: input.message.usage,
  };
}

function charge(offer: ModelOffer, usage: RawUsage): number {
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const written = usage.prompt_tokens_details?.cache_write_tokens ?? 0;
  const uncached = Math.max(0, usage.prompt_tokens - cached - written);

  const total =
    BigInt(uncached) * BigInt(offer.inputMicrosPerMillionTokens) +
    BigInt(cached) * BigInt(offer.cacheReadMicrosPerMillionTokens) +
    BigInt(written) * BigInt(offer.cacheWriteMicrosPerMillionTokens) +
    BigInt(usage.completion_tokens) * BigInt(offer.outputMicrosPerMillionTokens);

  return Number((total + tokensPerMillion - 1n) / tokensPerMillion);
}

function reservation(offer: ModelOffer): number {
  const rate = Math.max(
    offer.inputMicrosPerMillionTokens,
    offer.cacheReadMicrosPerMillionTokens,
    offer.cacheWriteMicrosPerMillionTokens,
  );

  const total =
    BigInt(offer.contextWindowTokens) * BigInt(rate) +
    BigInt(offer.maxOutputTokens) * BigInt(offer.outputMicrosPerMillionTokens);

  return Number((total + tokensPerMillion - 1n) / tokensPerMillion);
}

function providerBase(configuration: RuntimeConfiguration): string {
  const base = new URL(configuration.model.upstreamUrl);

  if (base.pathname === '/') {
    base.pathname = '/api/v1';
  }

  return base.href.replace(/\/$/u, '');
}

function usageTransport(
  response: Response,
  recordUsage: (usage: RawUsage) => void,
  recordError?: (error: unknown) => void,
): Response {
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

              const hasError = parsed !== null && typeof parsed === 'object' && 'error' in parsed;

              if (hasError && recordError !== undefined) {
                recordError(parsed.error);
              }

              if (parsed !== null && typeof parsed === 'object' && 'usage' in parsed) {
                if (Schema.is(RawUsage)(parsed.usage)) {
                  recordUsage(parsed.usage);
                }
              }
            }
          }
        }

        controller.enqueue(chunk);
      },
    }),
  );

  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

type ProviderTurnInput = {
  readonly transaction: Tx;
  readonly inputs: ReadonlyArray<SubmissionId> | undefined;
  readonly isGeneration: boolean;
};

async function providerTurn({ transaction, inputs, isGeneration }: ProviderTurnInput): Promise<TurnRecord | undefined> {
  if (isGeneration) {
    if (inputs === undefined || inputs.length === 0) {
      return undefined;
    }

    return await turnForNativeInputs(transaction, inputs);
  }

  if (inputs !== undefined) {
    const notifications = await notificationsForInputs(transaction, inputs);

    for (const notification of notifications) {
      const turn = await Turns.read(transaction, notification.turnId);

      if (turn !== undefined) {
        return turn;
      }
    }
  }

  return await Turns.lastInTransaction(transaction);
}

type RequiredAttemptInput = { readonly transaction: Tx; readonly id: string; readonly reason: string };

async function requireAttempt({ transaction, id, reason }: RequiredAttemptInput): Promise<AttemptRecord> {
  const attempt = await Attempts.read(transaction, id);

  if (attempt === undefined) {
    throw new Error(reason);
  }

  return attempt;
}

type ProviderDispatchInput = {
  readonly transaction: Tx;
  readonly attempt: AttemptRecord;
  readonly conversationId: ActorAccess['conversation']['id'];
  readonly isGeneration: boolean;
};

async function isProviderRequestCurrent({
  transaction,
  attempt,
  conversationId,
  isGeneration,
}: ProviderDispatchInput): Promise<boolean> {
  const state = await transaction.doc(State);
  const turn = await Turns.read(transaction, attempt.turnId);

  const hasControlHold = state.isQuiesced || state.isPolicyPaused || !state.isImportComplete;

  if (hasControlHold || state.isEnvironmentCheckpointRequired || turn === undefined) {
    return false;
  }

  if (decodeStored(RunRecord, turn.value).cancelRequestedAt !== null) {
    return false;
  }

  if (!isGeneration) {
    return true;
  }

  const live = await transaction.doc(LiveDoc, conversationId);

  return attempt.taskId !== null && live.run?.taskId === attempt.taskId && live.run.inputs.includes(turn.submissionId);
}

function meteredProviderStreams(getAccess: () => ActorAccess): ProviderStreams {
  function request({ model, transcript, options, isSimple }: ProviderRequestInput) {
    const outer = createAssistantMessageEventStream();

    async function runRequest(): Promise<void> {
      const access = getAccess();
      const isGeneration = typeof options?.onPayload === 'function';
      const offer = access.configuration.model.offers.find((candidate) => candidate.id === model.id);

      if (offer === undefined || !hasApi(model, 'openai-completions')) {
        throw new Error('The selected model is unavailable');
      }

      const attempt = await access.harness.commit(async (transaction) => {
        const state = await transaction.doc(State);

        if (state.isQuiesced || !state.isImportComplete || state.isEnvironmentCheckpointRequired) {
          throw new Error('The mech is fenced against provider dispatch');
        }

        const live = await transaction.doc(LiveDoc, access.conversation.id);

        const active = await providerTurn({ transaction, inputs: live.run?.inputs, isGeneration });

        if (active === undefined) {
          throw new Error('The provider request has no admitted owning turn');
        }

        const taskId: AttemptRecord['taskId'] = (() => {
          if (isGeneration) {
            return live.run?.taskId ?? null;
          }

          return null;
        })();

        const total = await Attempts.totalInTransaction(transaction);

        const record: AttemptRecord = {
          id: crypto.randomUUID(),
          turnId: active.id,
          taskId,
          ordinal: total + 1,
          fingerprint: '',
          model: model.id,
          reservedMicros: reservation(offer),
          phase: 'intent',
          refusalReason: null,
          usage: null,
          actualMicros: null,
        };

        await putAttempt(transaction, record);

        return record;
      }, BACKGROUND_CONTEXT);

      const dispatched: { count: number; usage: RawUsage | null } = { count: 0, usage: null };
      const admission: { refusal: string | null } = { refusal: null };
      const diagnostic = createProviderDiagnostic({ attemptId: attempt.id, generationTaskId: attempt.taskId });

      try {
        const trustedFetch: typeof fetch = async (resource, init) => {
          if (dispatched.count !== 0) {
            throw new Error('A provider attempted an unmetered HTTP retry');
          }

          const resourceUrl: string = (() => {
            if (resource instanceof Request) {
              return resource.url;
            }

            return String(resource);
          })();

          const url = new URL(resourceUrl);
          const base = new URL(providerBase(access.configuration));

          if (url.origin !== base.origin || url.pathname !== `${base.pathname.replace(/\/$/u, '')}/chat/completions`) {
            throw new Error('The provider dispatch target is not the configured endpoint');
          }

          if (typeof init?.body !== 'string') {
            throw new TypeError('The provider request has no canonical JSON body');
          }

          const requestFingerprint = await fingerprint({ model: model.id, body: init.body });

          await access.harness.commit(async (transaction) => {
            const saved = await requireAttempt({
              transaction,
              id: attempt.id,
              reason: 'The provider attempt intent disappeared',
            });

            if (saved.phase !== 'intent') {
              throw new Error('The provider attempt was already dispatched');
            }

            await putAttempt(transaction, { ...saved, fingerprint: requestFingerprint });
          }, BACKGROUND_CONTEXT);

          const identity = {
            ...access.scope,
            id: attempt.id,
            activationId: attempt.turnId,
            attemptOrdinal: attempt.ordinal,
            requestFingerprint,
            provider: model.provider,
            model: model.id,
            reservedMicros: attempt.reservedMicros,
          };

          const causation: { generationTaskId?: string } = {};

          if (attempt.taskId !== null) {
            causation.generationTaskId = String(attempt.taskId);
          }

          const admitted = await access.withControl((store) =>
            store.reserveProviderAttempt({ ...identity, ...causation }),
          );

          if (admitted.status === 'refused') {
            admission.refusal = admitted.reason;

            await access.harness.commit(async (transaction) => {
              const saved = await Attempts.read(transaction, attempt.id);

              if (saved !== undefined) {
                await putAttempt(transaction, { ...saved, phase: 'refused', refusalReason: admitted.reason });
              }
            }, BACKGROUND_CONTEXT);

            throw new Error(`Provider request refused: ${admitted.reason}`);
          }

          if (admitted.attempt.state !== 'reserved') {
            throw new Error('The provider attempt already has an uncertain dispatch');
          }

          await access.harness.commit(async (transaction) => {
            const saved = await requireAttempt({
              transaction,
              id: attempt.id,
              reason: 'The provider attempt intent disappeared',
            });

            await putAttempt(transaction, { ...saved, fingerprint: requestFingerprint, phase: 'reserved' });
          }, BACKGROUND_CONTEXT);

          const canDispatch = await access.harness.commit(async (transaction) => {
            const saved = await Attempts.read(transaction, attempt.id);

            const isCurrent = await isProviderRequestCurrent({
              transaction,
              attempt,
              conversationId: access.conversation.id,
              isGeneration,
            });

            const allowed = saved?.phase === 'reserved' && isCurrent;

            if (!allowed && saved !== undefined) {
              await putAttempt(transaction, { ...saved, phase: 'release' });
            }

            return allowed;
          }, BACKGROUND_CONTEXT);

          if (!canDispatch) {
            admission.refusal = 'execution_stopped';

            throw new Error('The provider request was superseded before dispatch');
          }

          const marked = await access.withControl(async (store) => {
            try {
              return await store.markProviderAttemptDispatched({ ...access.scope, id: attempt.id, requestFingerprint });
            } catch (error) {
              if (Schema.is(ProviderDispatchRefused)(error)) {
                admission.refusal = error.reason;

                await access.harness.commit(async (transaction) => {
                  const saved = await Attempts.read(transaction, attempt.id);

                  if (saved !== undefined) {
                    await putAttempt(transaction, { ...saved, phase: 'release', refusalReason: error.reason });
                  }
                }, BACKGROUND_CONTEXT);
              }

              throw error;
            }
          });

          await access.harness.commit(async (transaction) => {
            const saved = await requireAttempt({
              transaction,
              id: attempt.id,
              reason: 'The provider attempt intent disappeared',
            });

            await putAttempt(transaction, { ...saved, phase: 'dispatched' });

            const isCurrent = await isProviderRequestCurrent({
              transaction,
              attempt,
              conversationId: access.conversation.id,
              isGeneration,
            });

            if (!isCurrent) {
              throw new Error('The provider dispatch was fenced after authorization');
            }
          }, BACKGROUND_CONTEXT);

          if (!marked.wasMarked) {
            throw new Error('The provider attempt has an earlier uncertain dispatch');
          }

          dispatched.count += 1;
          const signals = [AbortSignal.timeout(requestTimeoutMs)];

          if (init.signal !== undefined && init.signal !== null) {
            signals.push(init.signal);
          }

          const response = await fetch(resource, { ...init, redirect: 'manual', signal: AbortSignal.any(signals) });
          const observed = observeProviderResponse(response, diagnostic);

          await rejectRedirect(observed);

          return usageTransport(
            observed,
            (usage) => {
              dispatched.usage = usage;
            },
            (error) => {
              diagnostic.record({ category: 'stream_error' });
              observeProviderError(diagnostic, error);
            },
          );
        };

        const transport: StreamOptions['transport'] = 'sse';

        const prepared = {
          ...options,
          apiKey: Redacted.value(access.configuration.model.apiKey),
          fetch: trustedFetch,
          maxRetries: 0,
          transport,
          maxTokens: Math.min(options?.maxTokens ?? offer.maxOutputTokens, offer.maxOutputTokens),
          timeoutMs: requestTimeoutMs,
        };

        const source: ReturnType<typeof stream> = (() => {
          if (isSimple) {
            return streamSimple(model, transcript, prepared);
          }

          return stream(model, transcript, prepared);
        })();

        for await (const event of source) {
          if (terminalEvents.has(event.type) && dispatched.usage !== null) {
            const actualMicros = charge(offer, dispatched.usage);

            await access.harness.commit(async (transaction) => {
              const saved = await requireAttempt({
                transaction,
                id: attempt.id,
                reason: 'The provider attempt receipt disappeared',
              });

              await putAttempt(transaction, {
                ...saved,
                phase: 'settlement',
                usage: JSON.stringify(dispatched.usage),
                actualMicros,
              });
            }, BACKGROUND_CONTEXT);
            await access.arm();
          }

          if (event.type === 'error') {
            const message = sanitizedFailure({
              message: event.error,
              model,
              contextWindowTokens: offer.contextWindowTokens,
              refusal: admission.refusal,
              capture: diagnostic,
            });

            outer.push({ type: 'error', reason: event.reason, error: message });
            outer.end(message);

            return;
          }

          outer.push(event);
        }

        outer.end(await source.result());
      } finally {
        if (dispatched.count === 0) {
          try {
            const stored = await access.withControl((store) =>
              store.getProviderAttempt({ ...access.scope, id: attempt.id }),
            );

            if (stored?.state === 'reserved') {
              await access.withControl((store) =>
                store.releaseUnusedProviderAttempt({
                  ...access.scope,
                  id: attempt.id,
                  requestFingerprint: stored.requestFingerprint,
                }),
              );
            }

            await access.harness.commit(async (transaction) => {
              const saved = await Attempts.read(transaction, attempt.id);

              if (saved !== undefined && saved.phase !== 'dispatched') {
                const phase: AttemptRecord['phase'] = (() => {
                  if (stored?.state === 'dispatched') {
                    return 'dispatched';
                  }

                  return 'refused';
                })();

                await putAttempt(transaction, { ...saved, phase });
              }
            }, BACKGROUND_CONTEXT);
          } catch {
            await access.harness.commit(async (transaction) => {
              const saved = await Attempts.read(transaction, attempt.id);

              if (saved !== undefined && saved.phase !== 'dispatched') {
                await putAttempt(transaction, { ...saved, phase: 'release' });
              }
            }, BACKGROUND_CONTEXT);
            await access.arm();
          }
        }
      }
    }

    void runRequest().catch(() => {
      const message: AssistantMessage = {
        role: 'assistant',
        api: model.api,
        provider: model.provider,
        model: model.id,
        content: [],
        stopReason: 'error',
        errorMessage: 'The model request failed before a confirmed result',
        timestamp: Date.now(),
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      };

      outer.push({ type: 'error', reason: 'error', error: message });
      outer.end(message);
    });

    return outer;
  }

  return {
    stream: (model, transcript, options) => request({ model, transcript, options, isSimple: false }),
    streamSimple: (model, transcript, options) => request({ model, transcript, options, isSimple: true }),
  };
}

export function createRuntimeModels(configuration: RuntimeConfiguration, getAccess: () => ActorAccess) {
  const models = createModels();
  const api = meteredProviderStreams(getAccess);

  const definitions: Array<Model<'openai-completions'>> = configuration.model.offers.map((offer) => {
    const input: Model<'openai-completions'>['input'] = ['text'];

    if (offer.supportsImages === true) {
      input.push('image');
    }

    return {
      id: offer.id,
      name: offer.id,
      api: 'openai-completions',
      provider: 'mechane',
      baseUrl: providerBase(configuration),
      reasoning: false,
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
      baseUrl: providerBase(configuration),
      auth: {
        apiKey: {
          name: 'Configured model gateway',
          resolve: async () => ({ auth: { apiKey: Redacted.value(configuration.model.apiKey) } }),
        },
      },
      models: definitions,
      api,
    }),
  );

  return models;
}
