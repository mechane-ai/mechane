import type { OperationCall } from '@mechane/client';
import type { Mech, SandboxRequest, Workspace } from '@mechane/protocol';
import type { Redacted } from 'effect';

export type SandboxCallInput = {
  readonly call: OperationCall<'manageSandbox'>;
  readonly token: Redacted.Redacted;
  readonly workspaceId: Workspace['id'];
  readonly mechId: Mech['id'];
  readonly request: SandboxRequest;
};
