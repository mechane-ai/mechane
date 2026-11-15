import { HttpMethod } from '@mechane/records';
import {
  sandboxExecutionCancelPendingPath,
  SandboxExecutionIdentity,
  sandboxExecutionPath,
  SandboxExecutionResult,
  sandboxExecutionResumePath,
} from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { BASH_OBSERVE_WAIT_MS, TOOL_REQUEST_TIMEOUT_MS, TOOL_RESPONSE_MAX_BYTES } from './constants.ts';
import { toolConfiguration } from './context.ts';
import { requestSandboxJson } from './sandbox-transport.ts';

type SandboxRequest = {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly executionId: string;
  readonly method: typeof HttpMethod.Get | typeof HttpMethod.Post;
  readonly body?: string;
  readonly isResume?: boolean;
  readonly waitMs?: number;
  readonly deadlineAt?: number;
};

type UnconfirmedExecutionInput = Pick<SandboxRequest, 'method'> & { readonly cause?: unknown };

/** A transport failure leaves the sandbox's authoritative receipt unknown. */
export class SandboxExecutionUnconfirmedError extends Error {
  readonly method: SandboxRequest['method'];

  constructor({ method, cause }: UnconfirmedExecutionInput) {
    super('The sandbox did not confirm an execution receipt', { cause });

    this.name = 'SandboxExecutionUnconfirmedError';
    this.method = method;
  }
}

export async function requestSandboxExecution(input: SandboxRequest): Promise<SandboxExecutionResult> {
  const configuration = toolConfiguration();
  const identity = Schema.decodeUnknownSync(SandboxExecutionIdentity)(input);
  const url = new URL(sandboxExecutionPath(identity), configuration.sandbox.origin);

  if (input.isResume === true) {
    url.pathname = sandboxExecutionResumePath(identity);
  }

  url.searchParams.set('waitMs', String(input.waitMs ?? BASH_OBSERVE_WAIT_MS));

  return await requestExecutionResult(
    { configuration, url, method: input.method, body: input.body ?? null, maximumBytes: TOOL_RESPONSE_MAX_BYTES },
    input.deadlineAt,
  );
}

export async function cancelPendingSandboxExecution(
  input: Pick<SandboxRequest, 'workspaceId' | 'mechId' | 'executionId' | 'deadlineAt'>,
): Promise<SandboxExecutionResult> {
  const configuration = toolConfiguration();
  const identity = Schema.decodeUnknownSync(SandboxExecutionIdentity)(input);
  const url = new URL(sandboxExecutionCancelPendingPath(identity), configuration.sandbox.origin);

  return await requestExecutionResult(
    { configuration, url, method: HttpMethod.Post, body: null, maximumBytes: TOOL_RESPONSE_MAX_BYTES },
    input.deadlineAt,
  );
}

async function requestExecutionResult(
  request: Parameters<typeof requestSandboxJson>[0],
  deadlineAt: number | undefined,
): Promise<SandboxExecutionResult> {
  const now = Date.now();
  const deadline = deadlineAt ?? now + TOOL_REQUEST_TIMEOUT_MS;
  const timeoutMs = Math.min(TOOL_REQUEST_TIMEOUT_MS, deadline - now);

  if (timeoutMs <= 0) {
    throw new SandboxExecutionUnconfirmedError({ method: request.method });
  }

  try {
    const body = await requestSandboxJson({ ...request, signal: AbortSignal.timeout(timeoutMs) });

    return decodeExecutionResult(body);
  } catch (cause) {
    if (deadlineAt !== undefined) {
      throw new SandboxExecutionUnconfirmedError({ method: request.method, cause });
    }

    throw cause;
  }
}

function decodeExecutionResult(body: unknown): SandboxExecutionResult {
  try {
    return Schema.decodeUnknownSync(SandboxExecutionResult)(body);
  } catch {
    throw new Error('The sandbox returned an invalid execution result');
  }
}
