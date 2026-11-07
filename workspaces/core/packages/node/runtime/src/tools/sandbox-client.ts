import type { HttpMethod } from '@mechane/records';
import {
  SandboxExecutionIdentity,
  sandboxExecutionPath,
  SandboxExecutionResult,
  sandboxExecutionResumePath,
} from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { loadRuntimeConfiguration } from '../config.ts';
import { BASH_OBSERVE_WAIT_MS, TOOL_RESPONSE_MAX_BYTES } from './constants.ts';
import { requestSandboxJson } from './sandbox-transport.ts';

type SandboxRequest = {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly executionId: string;
  readonly method: typeof HttpMethod.Get | typeof HttpMethod.Post;
  readonly body?: string;
  readonly isResume?: boolean;
  readonly waitMs?: number;
};

export async function requestSandboxExecution(input: SandboxRequest): Promise<SandboxExecutionResult> {
  const configuration = loadRuntimeConfiguration();
  const identity = Schema.decodeUnknownSync(SandboxExecutionIdentity)(input);
  const url = new URL(sandboxExecutionPath(identity), configuration.sandbox.origin);

  if (input.isResume === true) {
    url.pathname = sandboxExecutionResumePath(identity);
  }

  url.searchParams.set('waitMs', String(input.waitMs ?? BASH_OBSERVE_WAIT_MS));

  const body = await requestSandboxJson({
    configuration,
    url,
    method: input.method,
    body: input.body ?? null,
    maximumBytes: TOOL_RESPONSE_MAX_BYTES,
  });

  try {
    return Schema.decodeUnknownSync(SandboxExecutionResult)(body);
  } catch {
    throw new Error('The sandbox returned an invalid execution result');
  }
}
