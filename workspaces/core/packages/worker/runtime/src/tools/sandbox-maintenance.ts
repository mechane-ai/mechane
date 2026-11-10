import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { SandboxReport, SandboxRequest, SandboxServiceIdentity, sandboxWorkspacePath } from '@mechane/sandbox-wire';
import { Redacted, Schema } from 'effect';
import type { RuntimeConfiguration } from '../config.ts';
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
  const url = new URL(sandboxWorkspacePath(identity), configuration.sandbox.origin);
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
  });

  if (!response.ok) {
    await response.body?.cancel();

    throw new Error(`The sandbox maintenance request failed (${response.status})`);
  }

  const report = await readBoundedJson(response);

  return Schema.decodeUnknownSync(SandboxReport)(report);
}
