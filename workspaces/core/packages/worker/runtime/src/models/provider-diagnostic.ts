import { HttpStatusCode, RecordId } from '@mechane/records';
import { Schema } from 'effect';
import { NativeTaskId } from '../actor/records.ts';

const DIAGNOSTIC_MARKER = '\nMechane provider diagnostic: ';
const DIAGNOSTIC_MAX_CHARACTERS = 2048;
const ERROR_BODY_MAX_BYTES = 16_384;
const Fields = Schema.Record(Schema.String, Schema.Unknown);
const HttpStatus = Schema.Int;

const ProviderType = Schema.Literals([
  'invalid_request_error',
  'authentication_error',
  'permission_error',
  'not_found_error',
  'rate_limit_error',
  'api_error',
  'server_error',
  'overloaded_error',
  'insufficient_quota',
  'billing_error',
]);

const ProviderCode = Schema.Union([
  Schema.Enum(HttpStatusCode),
  Schema.Literals([
    'rate_limit_exceeded',
    'context_length_exceeded',
    'invalid_api_key',
    'model_not_found',
    'insufficient_quota',
    'invalid_request_error',
    'permission_denied',
    'content_filter',
    'moderation_blocked',
  ]),
]);

const ProviderParameter = Schema.Literals([
  'model',
  'messages',
  'tools',
  'max_tokens',
  'max_completion_tokens',
  'response_format',
  'temperature',
  'top_p',
  'stream',
  'reasoning',
  'reasoning_effort',
  'input',
  'prompt',
  'context_length',
]);

const GenerationId = Schema.String.check(
  Schema.isPattern(
    /^(?:gen-[0-9]{1,20}-[A-Za-z0-9_-]{1,128}|chatcmpl-[A-Za-z0-9_-]{1,128}|resp_[A-Za-z0-9_-]{1,128})$/u,
  ),
);

const Summary = Schema.Literals([
  'The model provider rejected the request',
  'The model provider service is temporarily unavailable',
  'context_length_exceeded',
  'Mech model admission stopped: workspace_suspended',
  'Mech model admission stopped: mech_disabled',
  'Mech model admission stopped: execution_stopped',
  'Mech model admission is out of budget: workspace_allowance',
  'Mech model admission is out of budget: mech_allowance',
]);

const ProviderDiagnostic = Schema.Struct({
  category: Schema.Literals(['provider_error', 'http_error', 'stream_error']),
  attempt_id: RecordId,
  generation_task_id: Schema.optionalKey(NativeTaskId),
  http_status: Schema.optionalKey(HttpStatus),
  provider_type: Schema.optionalKey(ProviderType),
  provider_code: Schema.optionalKey(ProviderCode),
  parameter: Schema.optionalKey(ProviderParameter),
  generation_id: Schema.optionalKey(GenerationId),
});

export type ProviderDiagnosticCapture = {
  readonly read: () => typeof ProviderDiagnostic.Type;
  readonly record: (fields: Partial<typeof ProviderDiagnostic.Type>) => void;
};

export function createProviderDiagnostic(input: {
  readonly attemptId: string;
  readonly generationTaskId: number | null;
}): ProviderDiagnosticCapture {
  const value: { diagnostic: typeof ProviderDiagnostic.Type } = {
    diagnostic: Schema.decodeUnknownSync(ProviderDiagnostic)({
      category: 'provider_error',
      attempt_id: input.attemptId,
    }),
  };

  if (input.generationTaskId !== null) {
    value.diagnostic = {
      ...value.diagnostic,
      generation_task_id: Schema.decodeUnknownSync(NativeTaskId)(input.generationTaskId),
    };
  }

  return {
    read: () => value.diagnostic,
    record: (fields) => {
      value.diagnostic = { ...value.diagnostic, ...fields };
    },
  };
}

export function observeProviderError(capture: ProviderDiagnosticCapture, value: unknown): void {
  if (!Schema.is(Fields)(value)) {
    return;
  }

  const type = value['type'];
  const code = value['code'];
  const parameter = value['param'];

  if (Schema.is(ProviderType)(type)) {
    capture.record({ provider_type: type });
  }

  if (Schema.is(ProviderCode)(code)) {
    capture.record({ provider_code: code });
  }

  if (Schema.is(ProviderParameter)(parameter)) {
    capture.record({ parameter });
  }
}

/** Observe bounded error fields while forwarding the original body to the native provider adapter unchanged. */
export function observeProviderResponse(response: Response, capture: ProviderDiagnosticCapture): Response {
  capture.record({ http_status: response.status });

  if (response.ok || response.body === null) {
    return response;
  }

  capture.record({ category: 'http_error' });

  const chunks: Array<Uint8Array> = [];
  const body = { sizeBytes: 0 };

  const observed = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        body.sizeBytes += chunk.byteLength;

        if (body.sizeBytes <= ERROR_BODY_MAX_BYTES) {
          chunks.push(chunk);
        } else {
          chunks.length = 0;
        }

        controller.enqueue(chunk);
      },
      flush() {
        if (body.sizeBytes > ERROR_BODY_MAX_BYTES) {
          return;
        }

        try {
          const decoder = new TextDecoder();
          const text = chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode();
          const parsed: unknown = JSON.parse(text);

          if (Schema.is(Fields)(parsed)) {
            observeProviderError(capture, parsed['error']);
          }
        } catch {
          // Missing diagnostics leave the native response and its conservative accounting intact.
        } finally {
          chunks.length = 0;
        }
      },
    }),
  );

  return new Response(observed, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export function formatProviderFailure(input: {
  readonly summary: string;
  readonly capture: ProviderDiagnosticCapture;
  readonly responseId: unknown;
}): string {
  const summary = Schema.decodeUnknownSync(Summary)(input.summary);
  const value = { ...input.capture.read() };

  if (Schema.is(GenerationId)(input.responseId)) {
    value.generation_id = input.responseId;
  }

  return summary + DIAGNOSTIC_MARKER + JSON.stringify(Schema.encodeSync(ProviderDiagnostic)(value));
}

/** Native failures expose only an exact, validated diagnostic; arbitrary native error text stays private. */
export function providerFailureReason(detail: unknown): string | undefined {
  if (typeof detail !== 'string' || detail.length > DIAGNOSTIC_MAX_CHARACTERS) {
    return;
  }

  const [summary, serialized, extra] = detail.split(DIAGNOSTIC_MARKER);

  if (!Schema.is(Summary)(summary) || serialized === undefined || extra !== undefined) {
    return;
  }

  try {
    const value = Schema.decodeUnknownSync(Schema.fromJsonString(ProviderDiagnostic), { onExcessProperty: 'error' })(
      serialized,
    );

    return summary + DIAGNOSTIC_MARKER + JSON.stringify(Schema.encodeSync(ProviderDiagnostic)(value));
  } catch {
    // Unrecognized native failures keep their generic inspection result.
    return undefined;
  }
}
