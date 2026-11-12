import { SANDBOX_OWNERS_PATH, SandboxOwnerPage } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { SandboxReport, sandboxWorkspacePath } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import type { LocalStack } from './types.ts';

const CAPTURE_MAX_ENVIRONMENTS = 16;
type CaptureEnvironmentReportsInput = { readonly stack: LocalStack; readonly signal: AbortSignal };
type ReadInput = { readonly url: URL; readonly credential: string; readonly signal: AbortSignal };

class EnvironmentCaptureUnavailable extends Schema.TaggedError<EnvironmentCaptureUnavailable>()(
  'EnvironmentCaptureUnavailable',
  {},
) {}

/** Captures a bounded first page of safe startup metadata before scenario resources are destroyed. */
export async function captureEnvironmentReports({ stack, signal }: CaptureEnvironmentReportsInput): Promise<string> {
  if (stack.sandbox === undefined) {
    return JSON.stringify({ isConfigured: false });
  }

  const sandbox = stack.sandbox;
  const credential = sandbox.bearer;
  const url = new URL(SANDBOX_OWNERS_PATH, stack.origin);
  const page = Schema.decodeUnknownSync(SandboxOwnerPage)(await read({ url, credential, signal }));
  const selected = page.owners.slice(0, CAPTURE_MAX_ENVIRONMENTS);

  const observations = await Promise.allSettled(
    selected.map(async (owner) => {
      const path = sandboxWorkspacePath(owner);
      const reportUrl = new URL(path, sandbox.origin);
      const report = Schema.decodeUnknownSync(SandboxReport)(await read({ url: reportUrl, credential, signal }));
      const encoded = Schema.encodeSync(SandboxReport)(report);

      return {
        owner,
        status: encoded.status,
        release: encoded.desired_image,
        startup: encoded.environment.startup,
        lastFailure: encoded.environment.last_startup_failure,
        execution: encoded.environment.execution,
      };
    }),
  );

  const reports = observations.map((observation, index) => {
    if (observation.status === 'fulfilled') {
      return { ...observation.value, isAvailable: true };
    }

    return { owner: selected[index], isAvailable: false };
  });

  return JSON.stringify({
    capturedAt: new Date().toISOString(),
    isTruncated: page.hasMore || page.owners.length > selected.length,
    reports,
  });
}

async function read({ url, credential, signal }: ReadInput): Promise<unknown> {
  const response = await fetch(url, { headers: { [HttpHeader.Authorization]: `Bearer ${credential}` }, signal });

  if (response.status !== HttpStatusCode.Ok) {
    await response.body?.cancel();

    throw new EnvironmentCaptureUnavailable({});
  }

  return await response.json();
}
