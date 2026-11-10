import { APICallError } from '@ai-sdk/provider';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { FatalError } from 'workflow';

type FailureCategory =
  | 'authentication'
  | 'permission'
  | 'quota'
  | 'rate_limit'
  | 'context_limit'
  | 'invalid_request'
  | 'provider_unavailable'
  | 'timeout'
  | 'transport'
  | 'invalid_response'
  | 'aborted'
  | 'unknown';

const CODE_CATEGORIES: ReadonlyMap<string, FailureCategory> = new Map([
  ['invalid_api_key', 'authentication'],
  ['insufficient_quota', 'quota'],
  ['rate_limit_exceeded', 'rate_limit'],
  ['context_length_exceeded', 'context_limit'],
  ['model_not_found', 'invalid_request'],
  ['invalid_request_error', 'invalid_request'],
  ['invalid_parameter', 'invalid_request'],
  ['unsupported_parameter', 'invalid_request'],
  ['server_error', 'provider_unavailable'],
  ['internal_server_error', 'provider_unavailable'],
  ['overloaded_error', 'provider_unavailable'],
  ['ECONNRESET', 'transport'],
  ['ECONNREFUSED', 'transport'],
  ['ENOTFOUND', 'transport'],
  ['ETIMEDOUT', 'timeout'],
]);

const TYPE_CATEGORIES: ReadonlyMap<string, FailureCategory> = new Map([
  ['authentication_error', 'authentication'],
  ['permission_error', 'permission'],
  ['rate_limit_error', 'rate_limit'],
  ['invalid_request_error', 'invalid_request'],
  ['server_error', 'provider_unavailable'],
  ['api_error', 'provider_unavailable'],
  ['overloaded_error', 'provider_unavailable'],
  ['AI_APICallError', 'unknown'],
  ['AI_JSONParseError', 'invalid_response'],
  ['AI_TypeValidationError', 'invalid_response'],
  ['AI_InvalidResponseDataError', 'invalid_response'],
  ['AI_InvalidArgumentError', 'invalid_request'],
  ['AI_UnsupportedFunctionalityError', 'invalid_request'],
  ['ModelUsageUnavailable', 'invalid_response'],
  ['ModelStreamCloseFailed', 'unknown'],
  ['AbortError', 'aborted'],
  ['TimeoutError', 'timeout'],
  ['TypeError', 'unknown'],
  ['FatalError', 'unknown'],
]);

const PARAMETERS: ReadonlySet<string> = new Set([
  'model',
  'messages',
  'tools',
  'tool_choice',
  'parallel_tool_calls',
  'max_tokens',
  'max_completion_tokens',
  'max_output_tokens',
  'temperature',
  'top_p',
  'response_format',
  'reasoning',
  'stream',
  'stop',
]);

const DOMAIN_FAILURE_TYPES: ReadonlyMap<string, string> = new Map([
  ['The model response ended without confirmed usage', 'ModelUsageUnavailable'],
  ['The model stream could not close cleanly; its reserved spend remains accounted for', 'ModelStreamCloseFailed'],
]);

const HTTP_ERROR_MAXIMUM = 599;
const FAILURE_PREFIX = 'The model request failed ';
const FAILURE_SUFFIX = '; its reserved spend remains accounted for';
const MAXIMUM_FAILURE_CHARACTERS = 512;

const FailureFields = Schema.Struct({
  name: Schema.optional(Schema.Unknown),
  type: Schema.optional(Schema.Unknown),
  code: Schema.optional(Schema.Unknown),
  statusCode: Schema.optional(Schema.Unknown),
  status: Schema.optional(Schema.Unknown),
  param: Schema.optional(Schema.Unknown),
  error: Schema.optional(Schema.Unknown),
  cause: Schema.optional(Schema.Unknown),
  generationId: Schema.optional(Schema.Unknown),
});

type FailureFields = typeof FailureFields.Type;

type KnownValueInput = {
  readonly value: unknown;
  readonly allowed: ReadonlySet<string> | ReadonlyMap<string, FailureCategory>;
};

type FailureFacts = {
  readonly type: string | undefined;
  readonly code: string | undefined;
  readonly status: number | undefined;
  readonly param: string | undefined;
};

export function modelFailure(error: unknown, generationId?: string): FatalError {
  const outer = failureFields(error);
  const state = { provider: outer, generationId: modelGenerationId(generationId) };

  if (APICallError.isInstance(error)) {
    const response = failureFields(error.data);

    state.provider = failureFields(response.error);
    state.generationId ??= modelGenerationId(error.responseHeaders?.['x-generation-id']);
  }

  const type =
    domainFailureType(error) ??
    knownValue({ value: state.provider.type, allowed: TYPE_CATEGORIES }) ??
    knownValue({ value: outer.name, allowed: TYPE_CATEGORIES });

  const code = knownValue({ value: state.provider.code, allowed: CODE_CATEGORIES }) ?? causeCode(outer);
  const status = httpStatus(outer.statusCode) ?? httpStatus(state.provider.status) ?? httpStatus(state.provider.code);
  const param = knownValue({ value: state.provider.param, allowed: PARAMETERS });
  const facts = { type, code, status, param };
  const category = failureCategory(facts);
  const diagnostics = JSON.stringify({ category, ...facts, generationId: state.generationId });

  return new FatalError(`${FAILURE_PREFIX}${diagnostics}${FAILURE_SUFFIX}`);
}

export function safeModelFailureText(error: unknown): string | undefined {
  const message = failureMessage(error);

  if (message === undefined) {
    return undefined;
  }

  if (DOMAIN_FAILURE_TYPES.has(message)) {
    return modelFailure(new FatalError(message)).message;
  }

  if (message.length > MAXIMUM_FAILURE_CHARACTERS) {
    return undefined;
  }

  if (!message.startsWith(FAILURE_PREFIX) || !message.endsWith(FAILURE_SUFFIX)) {
    return undefined;
  }

  const encoded = message.slice(FAILURE_PREFIX.length, -FAILURE_SUFFIX.length);

  try {
    const fields = Schema.decodeUnknownSync(Schema.fromJsonString(FailureFields))(encoded);

    return modelFailure(fields, modelGenerationId(fields.generationId)).message;
  } catch {
    return undefined;
  }
}

export function modelGenerationId(value: unknown): string | undefined {
  if (typeof value === 'string' && /^gen-[0-9A-Za-z-]{1,124}$/u.test(value)) {
    return value;
  }

  return undefined;
}

function causeCode(error: FailureFields): string | undefined {
  const cause = failureFields(error.cause);
  const nestedCause = failureFields(cause.cause);

  return (
    knownValue({ value: cause.code, allowed: CODE_CATEGORIES }) ??
    knownValue({ value: nestedCause.code, allowed: CODE_CATEGORIES })
  );
}

function domainFailureType(error: unknown): string | undefined {
  if (error instanceof FatalError) {
    return DOMAIN_FAILURE_TYPES.get(error.message);
  }

  return undefined;
}

function failureMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return undefined;
}

function failureFields(value: unknown): FailureFields {
  try {
    return Schema.decodeUnknownSync(FailureFields)(value);
  } catch {
    return {};
  }
}

function knownValue({ value, allowed }: KnownValueInput): string | undefined {
  if (typeof value === 'string' && allowed.has(value)) {
    return value;
  }

  return undefined;
}

function httpStatus(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return undefined;
  }

  if (value >= HttpStatusCode.BadRequest && value <= HTTP_ERROR_MAXIMUM) {
    return value;
  }

  return undefined;
}

function failureCategory({ type, code, status }: FailureFacts): FailureCategory {
  if (code !== undefined) {
    return CODE_CATEGORIES.get(code) ?? 'unknown';
  }

  if (status !== undefined) {
    switch (status) {
      case HttpStatusCode.Unauthorized:
        return 'authentication';
      case HttpStatusCode.Forbidden:
        return 'permission';
      case HttpStatusCode.TooManyRequests:
        return 'rate_limit';
      case HttpStatusCode.BadRequest:
      case HttpStatusCode.NotFound:
      case HttpStatusCode.PayloadTooLarge:
      case HttpStatusCode.Conflict:
        return 'invalid_request';
      default:
        break;
    }

    if (status >= HttpStatusCode.InternalServerError) {
      return 'provider_unavailable';
    }
  }

  if (type !== undefined) {
    return TYPE_CATEGORIES.get(type) ?? 'unknown';
  }

  return 'unknown';
}
