import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import type { ManagedWireObject } from './protocol.ts';

type ModelErrorType =
  | 'billing_error'
  | 'model_overloaded_error'
  | 'model_rate_limited_error'
  | 'model_request_failed_error';

type ModelFailure = { readonly type: ModelErrorType; readonly message: string };

const failed = 'model_request_failed_error';
const credit = 'provider_credit_exhausted';
const overloaded = 'model_overloaded';
const limited = 'model_rate_limited';
const credential = 'model_credential_rejected';
const forbidden = 'model_access_denied';
const missing = 'model_not_found';

const knownFailures: ReadonlyMap<string, ModelFailure> = new Map([
  ['gateway_credential_failed', { type: failed, message: 'The configured gateway credential supplier failed' }],
  [credit, { type: 'billing_error', message: 'The model gateway ran out of credit' }],
  ['workspace_allowance', { type: 'billing_error', message: 'The workspace reached its model spending limit' }],
  ['mech_allowance', { type: 'billing_error', message: 'The agent reached its model spending limit' }],
  [overloaded, { type: 'model_overloaded_error', message: 'The model provider is overloaded' }],
  [limited, { type: 'model_rate_limited_error', message: 'The model gateway rate-limited the request' }],
  [credential, { type: failed, message: 'Check the model credential configured on this installation' }],
  [forbidden, { type: failed, message: 'The configured credential lacks access to the selected model' }],
  [missing, { type: failed, message: 'The selected model is unavailable at the configured gateway' }],
  [
    'context_length_exceeded',
    { type: failed, message: 'The conversation exceeds the selected model’s context window' },
  ],
  ['workspace_suspended', { type: failed, message: 'The workspace is suspended' }],
  ['mech_disabled', { type: failed, message: 'The agent is disabled' }],
]);

const PAYMENT_REQUIRED = 402;
const UPSTREAM_OVERLOAD = 529;

export const modelHttpFailures: ReadonlyMap<number, string> = new Map([
  [HttpStatusCode.Unauthorized, credential],
  [PAYMENT_REQUIRED, credit],
  [HttpStatusCode.Forbidden, forbidden],
  [HttpStatusCode.NotFound, missing],
  [HttpStatusCode.TooManyRequests, limited],
  [UPSTREAM_OVERLOAD, overloaded],
]);

const streamFailures: ReadonlyMap<string, string> = new Map([
  ['insufficient_quota', credit],
  ['billing_error', credit],
  ['rate_limit_exceeded', limited],
  ['rate_limit_error', limited],
  ['overloaded_error', overloaded],
  ['invalid_api_key', credential],
  ['authentication_error', credential],
  ['permission_denied', forbidden],
  ['permission_error', forbidden],
  ['model_not_found', missing],
  ['context_length_exceeded', 'context_length_exceeded'],
]);

export function modelStreamFailure(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  if ('code' in error) {
    if (typeof error.code === 'number') {
      return modelHttpFailures.get(error.code);
    }

    if (typeof error.code === 'string' && streamFailures.has(error.code)) {
      return streamFailures.get(error.code);
    }
  }

  if ('type' in error && typeof error.type === 'string') {
    return streamFailures.get(error.type);
  }

  return undefined;
}

const REFUSAL_PREFIX = 'model_refusal:';

const RefusalStopDetails = Schema.Struct({
  type: Schema.Literal('refusal'),
  category: Schema.NullOr(Schema.Literals(['cyber', 'bio', 'frontier_llm', 'reasoning_extraction', 'general_harms'])),
  explanation: Schema.NullOr(Schema.String),
});

export function encodeModelRefusal(raw: unknown): string {
  const parsed = Schema.decodeUnknownResult(RefusalStopDetails)(raw);

  if (parsed._tag === 'Success') {
    return `${REFUSAL_PREFIX}${JSON.stringify(parsed.success)}`;
  }

  return `${REFUSAL_PREFIX}null`;
}

export function parseModelRefusal(detail: unknown): { readonly details: ManagedWireObject | null } | null {
  if (typeof detail !== 'string' || !detail.startsWith(REFUSAL_PREFIX)) {
    return null;
  }

  const encoded = detail.slice(REFUSAL_PREFIX.length);

  if (encoded === 'null') {
    return { details: null };
  }

  try {
    const parsed = Schema.decodeUnknownResult(RefusalStopDetails)(JSON.parse(encoded));

    if (parsed._tag === 'Success') {
      return { details: parsed.success };
    }
  } catch {
    return { details: null };
  }

  return { details: null };
}

export function managedModelError(detail: unknown, retryType: 'exhausted' | 'retrying' = 'exhausted') {
  if (typeof detail === 'string') {
    const error = knownFailures.get(detail);

    if (error !== undefined) {
      return { ...error, retry_status: { type: retryType } };
    }
  }

  return { type: failed, message: 'The model request failed.', retry_status: { type: retryType } };
}
