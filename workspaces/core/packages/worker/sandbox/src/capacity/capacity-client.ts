import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import {
  SANDBOX_CAPACITY_PATH,
  SandboxCapacityAction,
  SandboxCapacityRequest,
  SandboxCapacityResult,
} from '@mechane/sandbox-wire';
import type { SandboxCapacityIdentity } from '@mechane/sandbox-wire';
import { Duration, Option, Result, Schema } from 'effect';
import type { SandboxRuntimeSettings } from '../environment.ts';
import { runtimeHeaders, runtimeOrigin, sandboxServiceKey } from './runtime-transport.ts';

export type CapacityClient = {
  readonly acquire: (identity: SandboxCapacityIdentity) => Promise<SandboxCapacityResult>;
  readonly release: (identity: SandboxCapacityIdentity) => Promise<SandboxCapacityResult>;
};

type CapacityRequestInput = { readonly settings: SandboxRuntimeSettings; readonly request: SandboxCapacityRequest };

const CAPACITY_REQUEST_TIMEOUT = Duration.seconds(10);
const CAPACITY_RESPONSE_MAX_CHARACTERS = 1024;
const CapacityResultJson = Schema.fromJsonString(SandboxCapacityResult);

class CapacityRequestFailed extends Schema.TaggedError<CapacityRequestFailed>()('CapacityRequestFailed', {}) {}

/** Reservation callbacks use the same private service identity as the command boundary. */
export function capacityClient({ settings }: Pick<CapacityRequestInput, 'settings'>): CapacityClient {
  return {
    acquire: async (identity) =>
      await requestCapacity({ settings, request: { ...identity, action: SandboxCapacityAction.Acquire } }),
    release: async (identity) =>
      await requestCapacity({ settings, request: { ...identity, action: SandboxCapacityAction.Release } }),
  };
}

async function requestCapacity({ settings, request }: CapacityRequestInput): Promise<SandboxCapacityResult> {
  const origin = runtimeOrigin({ settings });
  const url = new URL(SANDBOX_CAPACITY_PATH, origin);
  const headers = await runtimeHeaders({ settings });
  const key = await sandboxServiceKey({ settings });
  const encoded = Schema.encodeSync(SandboxCapacityRequest)(request);
  const timeoutMs = Duration.toMillis(CAPACITY_REQUEST_TIMEOUT);
  const body = JSON.stringify(encoded);
  const signal = AbortSignal.timeout(timeoutMs);

  headers.set(HttpHeader.Authorization, `Bearer ${key}`);
  headers.set(HttpHeader.ContentType, MediaType.Json);

  const response = await fetch(url, { method: HttpMethod.Post, headers, body, redirect: 'manual', signal });

  if (!response.ok) {
    const stream = Option.fromNullishOr(response.body);

    if (Option.isSome(stream)) {
      await stream.value.cancel();
    }

    const cause = new CapacityRequestFailed({});
    const failure = Result.fail(cause);

    return Result.getOrThrow(failure);
  }

  const text = await response.text();

  if (text.length > CAPACITY_RESPONSE_MAX_CHARACTERS) {
    const cause = new CapacityRequestFailed({});
    const failure = Result.fail(cause);

    return Result.getOrThrow(failure);
  }

  const decoded = Schema.decodeUnknownResult(CapacityResultJson)(text);

  return Result.getOrThrow(decoded);
}
