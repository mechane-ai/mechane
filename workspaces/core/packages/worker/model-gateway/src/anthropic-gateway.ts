import { Schema } from 'effect';
import { observeGatewayEvents, RawUsage } from './gateway.ts';
import { matchesGatewayModel } from './managed-offers.ts';

const object = Schema.is(Schema.Record(Schema.String, Schema.Unknown));
const tokenCount = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }));
const optionalCounter = Schema.optionalKey(Schema.NullOr(tokenCount));

const NativeUsage = Schema.Struct({
  input_tokens: optionalCounter,
  output_tokens: optionalCounter,
  cache_read_input_tokens: optionalCounter,
  cache_creation_input_tokens: optionalCounter,
  cache_creation: Schema.optionalKey(
    Schema.NullOr(
      Schema.Struct({ ephemeral_1h_input_tokens: optionalCounter, ephemeral_5m_input_tokens: optionalCounter }),
    ),
  ),
  server_tool_use: Schema.optionalKey(
    Schema.NullOr(Schema.Struct({ web_search_requests: optionalCounter, web_fetch_requests: optionalCounter })),
  ),
  speed: Schema.optionalKey(Schema.NullOr(Schema.Literals(['standard', 'fast']))),
});

const isNativeUsage = Schema.is(NativeUsage);
const isNormalized = Schema.is(RawUsage);

type TokenTotals = {
  readonly input?: number | undefined;
  readonly output?: number | undefined;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  readonly oneHour?: number | undefined;
  readonly fiveMinutes?: number | undefined;
  readonly webSearchRequests: number;
  readonly webFetchRequests: number;
};

type Observers = {
  readonly response: Response;
  readonly modelId: string;
  readonly speed?: 'standard' | 'fast' | undefined;
  readonly recordUsage: (usage: RawUsage) => void;
  readonly recordError: (error: unknown) => void;
  readonly recordRefusal?: (details: unknown) => void;
  readonly onViolation: (reason: string) => void;
};

export function observeAnthropicGateway(observers: Observers): Response {
  if (!observers.response.ok) {
    return observers.response;
  }

  const speed = observers.speed ?? 'standard';
  let hasStarted = false;
  let hasStopped = false;
  let hasFinalOutput = false;
  let hasObservedFast = false;
  let totals: TokenTotals = { cacheRead: 0, cacheWrite: 0, webSearchRequests: 0, webFetchRequests: 0 };

  function violation(reason: string): never {
    observers.onViolation(reason);

    throw new Error(reason);
  }

  function observeUsage(raw: unknown, isTerminal: boolean): void {
    if (!isNativeUsage(raw)) {
      violation('The model gateway returned invalid token usage');
    }

    const usage = raw;

    if (typeof usage.speed === 'string' && usage.speed !== speed) {
      violation('The model gateway did not serve the selected inference speed');
    }

    if (usage.speed === 'fast') {
      hasObservedFast = true;
    }

    totals = {
      input: usage.input_tokens ?? totals.input,
      output: usage.output_tokens ?? totals.output,
      cacheRead: usage.cache_read_input_tokens ?? totals.cacheRead,
      cacheWrite: usage.cache_creation_input_tokens ?? totals.cacheWrite,
      oneHour: usage.cache_creation?.ephemeral_1h_input_tokens ?? totals.oneHour,
      fiveMinutes: usage.cache_creation?.ephemeral_5m_input_tokens ?? totals.fiveMinutes,
      webSearchRequests: usage.server_tool_use?.web_search_requests ?? totals.webSearchRequests,
      webFetchRequests: usage.server_tool_use?.web_fetch_requests ?? totals.webFetchRequests,
    };

    if (isTerminal && typeof usage.output_tokens === 'number') {
      hasFinalOutput = true;
    }
  }

  function finish(): void {
    if (!hasFinalOutput || totals.input === undefined || totals.output === undefined) {
      violation('The model provider did not return usage for this completion');
    }

    if (speed === 'fast' && !hasObservedFast) {
      violation('The model gateway did not confirm the selected inference speed');
    }

    const ttlCounts: { cache_write_1h_tokens?: number; cache_write_5m_tokens?: number } = {};

    if (totals.oneHour !== undefined) {
      ttlCounts.cache_write_1h_tokens = totals.oneHour;
    }

    if (totals.fiveMinutes !== undefined) {
      ttlCounts.cache_write_5m_tokens = totals.fiveMinutes;
    }

    const serverTools: { server_tool_use?: { web_search_requests: number; web_fetch_requests: number } } = {};

    if (totals.webSearchRequests > 0 || totals.webFetchRequests > 0) {
      serverTools.server_tool_use = {
        web_search_requests: totals.webSearchRequests,
        web_fetch_requests: totals.webFetchRequests,
      };
    }

    const normalized = {
      prompt_tokens: totals.input + totals.cacheRead + totals.cacheWrite,
      completion_tokens: totals.output,
      speed,
      prompt_tokens_details: { cached_tokens: totals.cacheRead, cache_write_tokens: totals.cacheWrite, ...ttlCounts },
      ...serverTools,
    };

    if (!isNormalized(normalized)) {
      violation('The model gateway returned inconsistent token usage');
    }

    observers.recordUsage(normalized);

    hasStopped = true;
  }

  return observeGatewayEvents(observers.response, (event) => {
    if (!object(event)) {
      violation('The model gateway returned an invalid message event');
    }

    if (event['type'] === 'ping') {
      return;
    }

    if (event['type'] === 'error') {
      observers.recordError(event['error']);

      return;
    }

    if (hasStopped) {
      violation('The model gateway returned multiple message completions');
    }

    if (event['type'] === 'message_start') {
      const message = event['message'];

      if (hasStarted || !object(message)) {
        violation('The model gateway did not confirm the selected model');
      }

      const served = message['model'];

      if (typeof served !== 'string' || !matchesGatewayModel(observers.modelId, served)) {
        violation('The model gateway did not confirm the selected model');
      }

      hasStarted = true;

      observeUsage(message['usage'], false);

      return;
    }

    if (!hasStarted) {
      violation('The model gateway did not confirm the selected model');
    }

    if (
      event['type'] === 'content_block_start' &&
      object(event['content_block']) &&
      event['content_block']['type'] === 'fallback'
    ) {
      violation('The model gateway switched away from the selected model');
    }

    if (event['type'] === 'message_delta') {
      const delta = event['delta'];

      if (object(delta) && delta['stop_reason'] === 'refusal') {
        observers.recordRefusal?.(delta['stop_details'] ?? null);
      }

      if (event['usage'] !== undefined) {
        observeUsage(event['usage'], object(delta) && typeof delta['stop_reason'] === 'string');
      }
    }

    if (event['type'] === 'message_stop') {
      finish();
    }
  });
}
