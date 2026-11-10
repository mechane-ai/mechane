import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { Duration, Option, Result, Schema } from 'effect';
import type { SandboxRuntimeSettings } from '../environment.ts';
import { runtimeOrigin, sandboxServiceKey } from './runtime-transport.ts';

type RuntimeRequestInput = {
  readonly settings: SandboxRuntimeSettings;
  readonly path: string;
  readonly body: Readonly<Record<string, unknown>>;
};

const RUNTIME_REQUEST_TIMEOUT = Duration.seconds(10);
const RUNTIME_RESPONSE_MAX_CHARACTERS = 1024;
const JsonResponse = Schema.fromJsonString(Schema.Unknown);

class RuntimeRequestFailed extends Schema.TaggedError<RuntimeRequestFailed>()('RuntimeRequestFailed', {}) {}

/** Private callbacks share the admitted host and credential boundary, while callers own their response schemas. */
export async function requestRuntimeJson({ settings, path, body }: RuntimeRequestInput): Promise<unknown> {
  const origin = runtimeOrigin({ settings });
  const url = new URL(path, origin);

  if (url.origin !== origin.origin) {
    return rejectRuntimeRequest();
  }

  const headers = new Headers();
  const key = await sandboxServiceKey({ settings });
  const timeoutMs = Duration.toMillis(RUNTIME_REQUEST_TIMEOUT);
  const signal = AbortSignal.timeout(timeoutMs);
  const encoded = JSON.stringify(body);

  headers.set(HttpHeader.Authorization, `Bearer ${key}`);
  headers.set(HttpHeader.ContentType, MediaType.Json);

  const response = await fetch(url, { method: HttpMethod.Post, headers, body: encoded, redirect: 'manual', signal });

  if (!response.ok) {
    const stream = Option.fromNullishOr(response.body);

    if (Option.isSome(stream)) {
      await stream.value.cancel();
    }

    return rejectRuntimeRequest();
  }

  const text = await response.text();

  if (text.length > RUNTIME_RESPONSE_MAX_CHARACTERS) {
    return rejectRuntimeRequest();
  }

  const decoded = Schema.decodeUnknownResult(JsonResponse)(text);

  return Result.getOrThrow(decoded);
}

function rejectRuntimeRequest(): never {
  const cause = new RuntimeRequestFailed({});
  const failure = Result.fail(cause);

  return Result.getOrThrow(failure);
}
