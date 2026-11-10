import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { Option } from 'effect';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { ModelCall, ModelCallSelector, ModelFixture, ModelPlan, ModelReply } from '../types.ts';
import { record, startHttpService, text } from './http.ts';
import type { HttpService } from './http.ts';

const DEFAULT_WAIT_MS = 30_000;
const DEFAULT_PROMPT_TOKENS = 20;
const DEFAULT_COMPLETION_TOKENS = 10;
const PROVIDER_KEY_BYTES = 24;
const MILLISECONDS_PER_SECOND = 1000;
const ESTIMATED_CHARACTERS_PER_TOKEN = 4;
const SUMMARIZATION_SYSTEM_PREFIX = 'You are a context summarization assistant.';
const SUMMARY_ROLES: ReadonlySet<string> = new Set(['system', 'developer']);

type PlanState = { readonly plan: ModelPlan; readonly next: number };
type Gate = ReturnType<typeof Promise.withResolvers<void>>;
export type StartedModel = { readonly fixture: ModelFixture; readonly close: HttpService['close'] };

export async function startModelFixture(): Promise<StartedModel> {
  const apiKey = `fixture-model-${randomBytes(PROVIDER_KEY_BYTES).toString('hex')}`;
  const plans = new Map<string, PlanState>();
  const calls: Array<ModelCall> = [];
  const gates = new Map<string, Gate>();
  const released = new Set<string>();
  const events = new EventTarget();

  function gateKey(input: ModelCallSelector): string {
    return JSON.stringify([input.marker, input.index]);
  }

  function configure(plan: ModelPlan): void {
    if (plan.marker.length === 0 || plan.replies.length === 0 || plans.has(plan.marker)) {
      throw new Error('A model plan needs a unique marker and at least one reply');
    }

    plans.set(plan.marker, { plan: structuredClone(plan), next: 0 });
  }

  async function waitForCall(input: ModelCallSelector): Promise<ModelCall> {
    const signal = AbortSignal.timeout(input.timeoutMs ?? DEFAULT_WAIT_MS);

    while (!signal.aborted) {
      const call = calls.find((candidate) => candidate.marker === input.marker && candidate.index === input.index);

      if (call !== undefined) {
        return structuredClone(call);
      }

      try {
        await once(events, 'call', { signal });
      } catch (cause) {
        throw new Error(`The model fixture did not reach plan ${input.marker} response ${input.index}`, { cause });
      }
    }

    throw new Error('Timed out waiting for the model fixture call');
  }

  function release(input: ModelCallSelector): void {
    const key = gateKey(input);

    released.add(key);
    gates.get(key)?.resolve();
  }

  async function handle(request: Request): Promise<Response> {
    if (new URL(request.url).pathname !== '/api/v1/chat/completions' || request.method !== HttpMethod.Post) {
      return Response.json({ error: 'Unknown model fixture route' }, { status: HttpStatusCode.NotFound });
    }

    if (request.headers.get(HttpHeader.Authorization) !== `Bearer ${apiKey}`) {
      return Response.json({ error: 'Invalid model credential' }, { status: HttpStatusCode.Unauthorized });
    }

    const body = record(await request.json());
    const prompts = userTexts(body['messages']);
    const finalUser = prompts.at(-1) ?? '';

    const selected =
      latestMatchingPlan(plans.values(), prompts.join('\n')) ??
      latestMatchingPlan(plans.values(), JSON.stringify(body['messages']));

    const purpose = modelRequestPurpose(body['messages']);
    const isSummary = purpose === 'compaction';
    const marker = selected?.plan.marker ?? finalUser;
    let index = selected?.next ?? calls.filter((call) => call.marker === marker).length;
    let reply: ModelReply = selected?.plan.replies[index] ?? { text: finalUser };

    if (isSummary) {
      index = -1;

      if (selected?.plan.summary === undefined) {
        reply = { status: HttpStatusCode.BadRequest };
      } else {
        reply = { text: selected.plan.summary };
      }
    }

    const isExhausted = selected !== undefined && !isSummary && index >= selected.plan.replies.length;

    if (selected !== undefined && !isSummary) {
      plans.set(selected.plan.marker, { ...selected, next: selected.next + 1 });
    }

    const call: ModelCall = {
      marker,
      index,
      purpose,
      body,
      authorization: request.headers.get(HttpHeader.Authorization) ?? undefined,
    };

    calls.push(call);
    events.dispatchEvent(new Event('call'));

    if (isExhausted) {
      return Response.json(
        { error: `The model exhausted plan ${marker} at response ${index}` },
        { status: HttpStatusCode.BadRequest },
      );
    }

    if (reply.isHeld === true) {
      const key = gateKey(call);
      const gate = Promise.withResolvers<void>();

      gates.set(key, gate);

      if (!released.has(key)) {
        await gate.promise;
      }

      gates.delete(key);
    }

    if (reply.status !== undefined && reply.status >= HttpStatusCode.BadRequest) {
      return Response.json(
        { error: { message: 'Configured provider failure', code: reply.status } },
        { status: reply.status },
      );
    }

    const promptCharacters = JSON.stringify(body['messages']).length;

    const estimatedPromptTokens = Math.max(
      DEFAULT_PROMPT_TOKENS,
      Math.ceil(promptCharacters / ESTIMATED_CHARACTERS_PER_TOKEN),
    );

    const measuredReply = { ...reply, promptTokens: reply.promptTokens ?? estimatedPromptTokens };

    return modelResponse(text(body['model']), measuredReply, body['stream'] === true);
  }

  const service = await startHttpService(handle);

  return {
    fixture: {
      origin: new URL('/api/v1', service.origin),
      apiKey,
      configure,
      readCalls: (input) =>
        structuredClone(calls.filter((call) => input?.marker === undefined || call.marker === input.marker)),
      waitForCall,
      release,
    },
    close: async () => {
      for (const gate of gates.values()) {
        gate.resolve();
      }

      await service.close();
    },
  };
}

function latestMatchingPlan(plans: Iterable<PlanState>, prompt: string): PlanState | undefined {
  let selected = Option.none<PlanState>();
  let lastOffset = -1;

  for (const candidate of plans) {
    const offset = prompt.lastIndexOf(candidate.plan.marker);

    if (offset > lastOffset) {
      selected = Option.some(candidate);
      lastOffset = offset;
    }
  }

  return Option.getOrUndefined(selected);
}

function userTexts(value: unknown): ReadonlyArray<string> {
  if (!Array.isArray(value)) {
    throw new TypeError('The model request has no messages');
  }

  const messages = value.map((message) => record(message)).filter((message) => message['role'] === 'user');

  return messages.map((message) => messageText(message['content']));
}

function messageText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => record(part))
      .filter((part) => part['type'] === 'text')
      .map((part) => text(part['text']))
      .join('\n');
  }

  return '';
}

function modelRequestPurpose(value: unknown): ModelCall['purpose'] {
  if (!Array.isArray(value)) {
    throw new TypeError('The model request has no messages');
  }

  const hasSummaryPrompt = value.some((candidate) => {
    const message = record(candidate);
    const role = message['role'];

    if (typeof role !== 'string' || !SUMMARY_ROLES.has(role)) {
      return false;
    }

    return messageText(message['content']).startsWith(SUMMARIZATION_SYSTEM_PREFIX);
  });

  if (hasSummaryPrompt) {
    return 'compaction';
  }

  return 'generation';
}

function modelResponse(model: string, reply: ModelReply, isStreaming: boolean): Response {
  const id = reply.streamResponseId ?? `chatcmpl-${randomUUID()}`;
  const created = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);

  if (reply.streamError !== undefined) {
    const chunks: Array<Readonly<Record<string, unknown>>> = [];

    if (reply.streamResponseId !== undefined) {
      chunks.push({
        id,
        created,
        model,
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
      });
    }

    chunks.push({ error: reply.streamError });

    return eventStream(chunks);
  }

  const promptTokens = reply.promptTokens ?? DEFAULT_PROMPT_TOKENS;
  const completionTokens = reply.completionTokens ?? DEFAULT_COMPLETION_TOKENS;

  const usage = {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
    prompt_tokens_details: { cached_tokens: 0 },
    cost: 0.0001,
  };

  const tools = reply.tools?.map((tool) => ({
    id: tool.id,
    type: 'function',
    function: { name: tool.name, arguments: JSON.stringify(tool.input) },
  }));

  const finishReason = replyFinishReason(reply);
  const message = { role: 'assistant', content: reply.text ?? null, tool_calls: tools };

  if (!isStreaming) {
    return Response.json({
      id,
      created,
      model,
      object: 'chat.completion',
      choices: [{ index: 0, message, finish_reason: finishReason }],
      usage,
    });
  }

  const delta = {
    role: 'assistant',
    content: reply.text,
    tool_calls: tools?.map((tool, index) => ({ index, ...tool })),
  };

  const chunks = [
    { id, created, model, object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason: null }] },
    {
      id,
      created,
      model,
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
      usage,
    },
  ];

  return eventStream(chunks);
}

function eventStream(chunks: ReadonlyArray<Readonly<Record<string, unknown>>>): Response {
  const body = `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`;

  return new Response(body, {
    headers: { [HttpHeader.ContentType]: MediaType.EventStream, [HttpHeader.CacheControl]: 'no-cache' },
  });
}

function replyFinishReason(reply: ModelReply): 'stop' | 'tool_calls' {
  if (reply.tools !== undefined) {
    return 'tool_calls';
  }

  return 'stop';
}
