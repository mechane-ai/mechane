import { BrowserEvidenceProgress } from '@mechane/protocol';
import { HttpMethod } from '@mechane/records';
import { SandboxBrowserIdentity, sandboxBrowserPath } from '@mechane/sandbox-wire';
import type { SandboxBrowserSubmission } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { loadRuntimeConfiguration } from '../../config.ts';
import { requestSandboxJson } from '../sandbox-transport.ts';
import type { RuntimeToolContext } from '../types.ts';

const BROWSER_SERVICE_MAX_BYTES = 2_097_152;
const INTERRUPTED_REQUEST_NAMES: ReadonlySet<string> = new Set(['AbortError', 'TimeoutError']);

/** A transport interruption may precede admission; retrying keeps the same immutable native request. */
export class BrowserTransportInterruptedError extends Error {
  readonly executionId: string;

  constructor(input: { readonly executionId: string; readonly cause: unknown }) {
    super('The browser transport was interrupted', { cause: input.cause });

    this.name = 'BrowserTransportInterruptedError';
    this.executionId = input.executionId;
  }
}

type BrowserRequestInput = RuntimeToolContext & {
  readonly executionId: string;
  /** Null observes the existing receipt without dispatching any browser action. */
  readonly submission: typeof SandboxBrowserSubmission.Encoded | null;
};

/** This private transport carries trusted native call identity, never a model-selected sandbox owner. */
export async function requestBrowser(input: BrowserRequestInput): Promise<BrowserEvidenceProgress> {
  const configuration = loadRuntimeConfiguration();
  const identity = Schema.decodeUnknownSync(SandboxBrowserIdentity)({ ...input, requestId: input.executionId });
  const url = new URL(sandboxBrowserPath(identity), configuration.sandbox.origin);

  const operation: { readonly method: typeof HttpMethod.Get | typeof HttpMethod.Post; readonly body: string | null } =
    (() => {
      if (input.submission === null) {
        return { method: HttpMethod.Get, body: null };
      }

      return { method: HttpMethod.Post, body: JSON.stringify(input.submission) };
    })();

  const value = await requestSandboxJson({
    configuration,
    url,
    method: operation.method,
    body: operation.body,
    maximumBytes: BROWSER_SERVICE_MAX_BYTES,
  }).catch((cause: unknown) => {
    const isAborted = cause instanceof DOMException && INTERRUPTED_REQUEST_NAMES.has(cause.name);

    if (cause instanceof TypeError || isAborted) {
      throw new BrowserTransportInterruptedError({ executionId: input.executionId, cause });
    }

    throw cause;
  });

  return Schema.decodeUnknownSync(BrowserEvidenceProgress)(value);
}
