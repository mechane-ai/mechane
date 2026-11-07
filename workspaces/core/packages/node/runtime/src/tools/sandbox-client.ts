import type { HttpMethod } from '@mechane/records';
import { HttpHeader, MediaType } from '@mechane/records';
import {
  SandboxExecutionIdentity,
  sandboxExecutionPath,
  SandboxExecutionResult,
  sandboxExecutionResumePath,
} from '@mechane/sandbox-wire';
import { Redacted, Schema } from 'effect';
import { loadRuntimeConfiguration } from '../config.ts';
import { BASH_OBSERVE_WAIT_MS, TOOL_REQUEST_TIMEOUT_MS } from './constants.ts';
import { readBoundedJson } from './http.ts';

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

  const response = await fetch(url, {
    method: input.method,
    headers: {
      [HttpHeader.Authorization]: `Bearer ${Redacted.value(configuration.sandbox.bearer)}`,
      [HttpHeader.ContentType]: MediaType.Json,
    },
    body: input.body ?? null,
    redirect: 'error',
    signal: AbortSignal.timeout(TOOL_REQUEST_TIMEOUT_MS),
  });

  const body = await readBoundedJson(response);

  try {
    return Schema.decodeUnknownSync(SandboxExecutionResult)(body);
  } catch {
    throw new Error('The sandbox returned an invalid execution result');
  }
}
