import { SandboxMaintenanceFailed } from '@mechane/cli-kernel';
import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { SandboxAction } from '@mechane/protocol';
import { SandboxOperationId } from '@mechane/records';
import { Effect, Option } from 'effect';
import { randomUUID } from 'node:crypto';
import { withWorkspace } from '../mechs/with-workspace.ts';
import { maintainSandbox } from './maintain-sandbox.ts';
import { saveArchive } from './save-archive.ts';
import type { SandboxCallInput } from './types.ts';

type ExportWorkspaceInput = SandboxCallInput & { readonly file: string };

/** Uses normal workspace authentication; provider credentials never leave the Worker. */
export const runSandboxExport = Effect.fn('runSandboxExport')(function* ({
  call,
  origin,
  input,
  credentials,
}: RunInput<'sandbox export'>): Effect.fn.Return<CommandResult<'sandbox export'>, RunFailure> {
  const fallback = SandboxOperationId.make(randomUUID());
  const specified = Option.fromNullishOr(input.operationId);
  const operationId = Option.getOrElse(specified, () => fallback);

  const request = {
    action: SandboxAction.Export,
    operationId: Option.some(operationId),
    droneId: Option.fromNullishOr(input.droneId),
    part: 0,
  };

  return yield* withWorkspace({
    call,
    origin,
    credentials,
    use: ({ token, workspaceId }) =>
      exportWorkspace({ call, token, workspaceId, mechId: input.mechId, request, file: input.file }),
  });
});

const exportWorkspace = Effect.fn('exportWorkspace')(function* ({
  file: destination,
  ...context
}: ExportWorkspaceInput): Effect.fn.Return<CommandResult<'sandbox export'>, RunFailure> {
  const sandbox = yield* maintainSandbox(context);

  if (Option.isNone(sandbox.archive)) {
    return yield* new SandboxMaintenanceFailed({ reason: 'the completed operation has no export archive' });
  }

  const archive = sandbox.archive.value;
  const file = yield* saveArchive({ ...context, archive, file: destination });

  return { lines: [`saved ${archive.bytes} bytes to ${file}`, `SHA-256 ${archive.sha256}`], result: { sandbox, file } };
});
