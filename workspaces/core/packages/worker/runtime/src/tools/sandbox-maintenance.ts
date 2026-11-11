import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { SandboxReport, SandboxRequest, SandboxServiceIdentity, sandboxWorkspacePath } from '@mechane/sandbox-wire';
import { Option, Redacted, Schema } from 'effect';
import type { RuntimeConfiguration } from '../config.ts';
import { writeSandboxMaintenanceFailure } from '../output/write-actor-diagnostic.ts';
import type { SandboxMaintenancePhase } from '../output/write-actor-diagnostic.ts';
import { TOOL_REQUEST_TIMEOUT_MS } from './constants.ts';
import { readBoundedJson } from './http.ts';

type ManageSandboxInput = {
  readonly configuration: RuntimeConfiguration;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly request: SandboxRequest;
};

export async function manageSandboxWorkspace({
  configuration,
  workspaceId,
  mechId,
  request,
}: ManageSandboxInput): Promise<SandboxReport> {
  const identity = Schema.decodeUnknownSync(SandboxServiceIdentity)({ workspaceId, mechId });
  const pathname = sandboxWorkspacePath(identity);
  const url = new URL(pathname, configuration.sandbox.origin);
  const body = Schema.encodeSync(SandboxRequest)(request);

  const response = await fetch(url, {
    method: HttpMethod.Post,
    headers: {
      [HttpHeader.Authorization]: `Bearer ${Redacted.value(configuration.sandbox.bearer)}`,
      [HttpHeader.ContentType]: MediaType.Json,
    },
    body: JSON.stringify(body),
    redirect: 'manual',
    signal: AbortSignal.timeout(TOOL_REQUEST_TIMEOUT_MS),
  }).catch((cause: unknown) => {
    writeSandboxMaintenanceFailure({ cause, pathname, phase: 'fetch', status: Option.none(), ray: Option.none() });

    throw cause;
  });

  const status = Option.some(response.status);
  const ray = Option.fromNullishOr(response.headers.get(HttpHeader.CloudflareRay));
  let phase: SandboxMaintenancePhase = 'http';

  try {
    if (!response.ok) {
      await response.body?.cancel();

      throw new Error(`The sandbox maintenance request failed (${response.status})`);
    }

    phase = 'body';
    const report = await readBoundedJson(response);
    phase = 'decode';

    return Schema.decodeUnknownSync(SandboxReport)(report);
  } catch (cause) {
    writeSandboxMaintenanceFailure({ cause, pathname, phase, status, ray });

    throw cause;
  }
}
