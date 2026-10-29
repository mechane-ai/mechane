import { SandboxMaintenanceFailed } from '@mechane/cli-kernel';
import type { RunFailure } from '@mechane/cli-kernel';
import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import type { SandboxReport } from '@mechane/protocol';
import { Array, Effect, Option } from 'effect';
import { maintainSandbox } from '../maintain-sandbox.ts';
import { maintenanceFailure } from '../maintenance-failure.ts';
import type { SandboxCallInput } from '../types.ts';
import { readImportPart } from './read-import-part.ts';
import type { ImportArchive } from './types.ts';

type UploadImportArchiveInput = SandboxCallInput & ImportArchive;

/** Resumes the server cursor before asking the guest to verify and commit the uploaded archive. */
export const uploadImportArchive = Effect.fn('uploadImportArchive')(function* ({
  handle,
  archive,
  ...input
}: UploadImportArchiveInput): Effect.fn.Return<SandboxReport, RunFailure> {
  const { call, token, workspaceId, mechId, request } = input;
  const initial = yield* call({ name: 'manageSandbox', credential: token, input: { ...request, workspaceId, mechId } });
  const reason = maintenanceFailure({ report: initial, request });

  if (Option.isSome(reason)) {
    return yield* new SandboxMaintenanceFailed({ reason: reason.value });
  }

  if (initial.phase === SandboxPhase.Copy) {
    const indexes = Array.range(0, archive.parts - 1);
    const remaining = indexes.slice(initial.part);

    for (const part of remaining) {
      yield* uploadArchivePart({ ...input, handle, archive, part });
    }
  }

  return yield* maintainSandbox(input);
});

type UploadArchivePartInput = UploadImportArchiveInput & { readonly part: number };

const uploadArchivePart = Effect.fn('uploadArchivePart')(function* ({
  handle,
  archive,
  part,
  call,
  token,
  workspaceId,
  mechId,
  request,
}: UploadArchivePartInput): Effect.fn.Return<void, RunFailure> {
  const body = yield* readImportPart({ handle, part, bytes: archive.bytes });
  const base64 = body.toString('base64');

  const report = yield* call({
    name: 'manageSandbox',
    credential: token,
    input: { ...request, workspaceId, mechId, action: SandboxAction.Upload, part, base64 },
  });

  const failed = maintenanceFailure({ report, request });

  if (Option.isSome(failed) || report.part !== part + 1) {
    return yield* new SandboxMaintenanceFailed({
      reason: 'the import upload did not advance; resume with its operation id',
    });
  }
});
