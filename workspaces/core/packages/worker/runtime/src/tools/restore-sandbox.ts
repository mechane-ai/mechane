import { HttpMethod } from '@mechane/records';
import {
  sandboxRestorePath,
  SandboxRestoreRequest,
  SandboxRestoreResult,
  SandboxServiceIdentity,
} from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import type { RuntimeConfiguration } from '../config.ts';
import { TOOL_RESPONSE_MAX_BYTES } from './constants.ts';
import { requestSandboxJson } from './sandbox-transport.ts';

type RestoreSandboxInput = {
  readonly configuration: RuntimeConfiguration;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly request: SandboxRestoreRequest;
};

export async function restoreSandboxWorkspace(input: RestoreSandboxInput): Promise<SandboxRestoreResult> {
  const identity = Schema.decodeUnknownSync(SandboxServiceIdentity)(input);
  const path = sandboxRestorePath(identity);
  const url = new URL(path, input.configuration.sandbox.origin);
  const encoded = Schema.encodeSync(SandboxRestoreRequest)(input.request);
  const body = JSON.stringify(encoded);

  const response = await requestSandboxJson({
    ...input,
    url,
    method: HttpMethod.Post,
    body,
    maximumBytes: TOOL_RESPONSE_MAX_BYTES,
  });

  return Schema.decodeUnknownSync(SandboxRestoreResult)(response);
}
