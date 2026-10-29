import type { SandboxRequest } from '@mechane/protocol';
import type { ExecutionId } from '@mechane/sandbox-wire';

/** The normal protocol request crossing the internal sandbox RPC boundary. */
export type SandboxManageInput = { readonly request: typeof SandboxRequest.Encoded };
export type SandboxCancelInput = { readonly executionId: ExecutionId };
