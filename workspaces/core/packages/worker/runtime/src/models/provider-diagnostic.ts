import { HttpStatusCode, RecordId } from '@mechane/records';
import { Schema } from 'effect';
import { NativeTaskId } from '../actor/records.ts';

const DIAGNOSTIC_MARKER = '\nMechane provider diagnostic: ';
const DIAGNOSTIC_MAX_CHARACTERS = 2048;
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
  'Mechane could not confirm model admission',
  'The Mechane model admission service is temporarily unavailable',
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
  category: Schema.Literals(['admission_error', 'provider_error', 'http_error', 'stream_error']),
  attempt_id: RecordId,
  generation_task_id: Schema.optionalKey(NativeTaskId),
  http_status: Schema.optionalKey(HttpStatus),
  provider_type: Schema.optionalKey(ProviderType),
  provider_code: Schema.optionalKey(ProviderCode),
  parameter: Schema.optionalKey(ProviderParameter),
  generation_id: Schema.optionalKey(GenerationId),
});

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
