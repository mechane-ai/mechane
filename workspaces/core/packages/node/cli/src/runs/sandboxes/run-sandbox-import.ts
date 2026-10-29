import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { SandboxAction } from '@mechane/protocol';
import { SandboxOperationId } from '@mechane/records';
import { Effect, Option } from 'effect';
import type { Scope } from 'effect';
import { randomUUID } from 'node:crypto';
import { withWorkspace } from '../mechs/with-workspace.ts';
import { announceMaintenance } from './announce-maintenance.ts';
import { openImportArchive } from './imports/open-import-archive.ts';
import { uploadImportArchive } from './imports/upload-import-archive.ts';

/** Restores through ordinary workspace authentication without exposing provider credentials. */
export const runSandboxImport = Effect.fn('runSandboxImport')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'sandbox import'>): Effect.fn.Return<CommandResult<'sandbox import'>, RunFailure, Scope.Scope> {
  const opened = yield* openImportArchive({ file: input.file });
  const fallback = SandboxOperationId.make(randomUUID());
  const requested = Option.fromNullishOr(input.operationId);
  const operationId = Option.getOrElse(requested, () => fallback);

  const request = {
    action: SandboxAction.Import,
    operationId: Option.some(operationId),
    droneId: Option.fromNullishOr(input.droneId),
    part: 0,
    archive: opened.archive,
  };

  announceMaintenance({ operationId: request.operationId });

  const result = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      uploadImportArchive({ call, token, workspaceId, mechId: input.mechId, request, ...opened }),
  });

  return { lines: [`restored ${opened.archive.bytes} bytes on ${result.provider}`], result };
}, Effect.scoped);
