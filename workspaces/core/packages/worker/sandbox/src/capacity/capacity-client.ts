import {
  SANDBOX_CAPACITY_PATH,
  SandboxCapacityAction,
  SandboxCapacityRequest,
  SandboxCapacityResult,
} from '@mechane/sandbox-wire';
import type { SandboxCapacityIdentity } from '@mechane/sandbox-wire';
import { Result, Schema } from 'effect';
import type { SandboxRuntimeSettings } from '../environment.ts';
import { requestRuntimeJson } from './request-runtime-json.ts';

export type CapacityClient = {
  readonly acquire: (identity: SandboxCapacityIdentity) => Promise<SandboxCapacityResult>;
  readonly release: (identity: SandboxCapacityIdentity) => Promise<SandboxCapacityResult>;
};

type CapacityRequestInput = { readonly settings: SandboxRuntimeSettings; readonly request: SandboxCapacityRequest };

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
  const encoded = Schema.encodeSync(SandboxCapacityRequest)(request);
  const response = await requestRuntimeJson({ settings, path: SANDBOX_CAPACITY_PATH, body: encoded });
  const decoded = Schema.decodeUnknownResult(SandboxCapacityResult)(response);

  return Result.getOrThrow(decoded);
}
