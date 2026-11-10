import { HttpMethod } from '@mechane/records';
import {
  ProcessHandle,
  ProcessObservation,
  ProcessSummaries,
  SandboxProcessAnswer,
  sandboxProcessesPath,
  SandboxProcessIdentity,
  sandboxProcessPath,
  sandboxProcessReadPath,
  sandboxProcessStopPath,
  SandboxServiceIdentity,
} from '@mechane/sandbox-wire';
import type { SandboxProcessSubmission } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import type { RuntimeConfiguration } from '../../config.ts';
import { TOOL_RESPONSE_MAX_BYTES } from '../constants.ts';
import { requestSandboxJson } from '../sandbox-transport.ts';

type ProcessScope = {
  readonly configuration: RuntimeConfiguration;
  readonly workspaceId: string;
  readonly mechId: string;
};

type ProcessIdentity = ProcessScope & { readonly processId: string };
type ProcessSelection = ProcessIdentity & { readonly machineId: string };
type ProcessRead = ProcessSelection & { readonly shouldTouch: boolean };
type ProcessSubmission = ProcessIdentity & { readonly submission: typeof SandboxProcessSubmission.Encoded };
type ProcessList = ProcessScope & { readonly shouldTouch: boolean };

type ProcessRequest = ProcessScope & {
  readonly path: string;
  readonly method: typeof HttpMethod.Get | typeof HttpMethod.Post;
  readonly body: string | null;
};

/** Sends immutable native identity and current credentials only to the private sandbox service. */
export async function submitProcess(input: ProcessSubmission): Promise<SandboxProcessAnswer> {
  const identity = Schema.decodeUnknownSync(SandboxProcessIdentity)(input);
  const path = sandboxProcessPath(identity);
  const body = JSON.stringify(input.submission);
  const result = await requestProcess({ ...input, path, method: HttpMethod.Post, body });

  return Schema.decodeUnknownSync(SandboxProcessAnswer)(result);
}

export async function observeSandboxProcessStart(input: ProcessIdentity): Promise<SandboxProcessAnswer> {
  const identity = Schema.decodeUnknownSync(SandboxProcessIdentity)(input);
  const path = sandboxProcessPath(identity);
  const result = await requestProcess({ ...input, path, method: HttpMethod.Get, body: null });

  return Schema.decodeUnknownSync(SandboxProcessAnswer)(result);
}

/** Lists bounded summaries; passive Console polling does not renew machine activity. */
export async function listSandboxProcesses(input: ProcessList): Promise<ProcessSummaries> {
  const identity = Schema.decodeUnknownSync(SandboxServiceIdentity)(input);
  const path = sandboxProcessesPath({ ...identity, shouldTouch: input.shouldTouch });
  const body = await requestProcess({ ...input, path, method: HttpMethod.Get, body: null });

  return Schema.decodeUnknownSync(ProcessSummaries)(body);
}

/** Reads only the exact original machine and process handle. */
export async function readSandboxProcess(input: ProcessRead): Promise<ProcessObservation> {
  const identity = Schema.decodeUnknownSync(SandboxProcessIdentity)(input);
  const path = sandboxProcessReadPath({ ...identity, shouldTouch: input.shouldTouch });

  return await observeHandle({ ...input, path });
}

/** Stops the owned process group without affecting other managed handles. */
export async function stopSandboxProcess(input: ProcessSelection): Promise<ProcessObservation> {
  const identity = Schema.decodeUnknownSync(SandboxProcessIdentity)(input);
  const path = sandboxProcessStopPath(identity);

  return await observeHandle({ ...input, path });
}

async function observeHandle(input: ProcessSelection & { readonly path: string }): Promise<ProcessObservation> {
  const handle = Schema.decodeUnknownSync(Schema.toType(ProcessHandle))(input);
  const encoded = Schema.encodeSync(ProcessHandle)(handle);
  const body = JSON.stringify(encoded);
  const result = await requestProcess({ ...input, method: HttpMethod.Post, body });

  return Schema.decodeUnknownSync(ProcessObservation)(result);
}

async function requestProcess(input: ProcessRequest): Promise<unknown> {
  const url = new URL(input.path, input.configuration.sandbox.origin);

  return await requestSandboxJson({ ...input, url, maximumBytes: TOOL_RESPONSE_MAX_BYTES });
}
