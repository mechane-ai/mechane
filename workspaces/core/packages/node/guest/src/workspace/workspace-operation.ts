import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { SandboxArchive, WorkspaceStep } from '@mechane/sandbox-wire';
import { Effect, Schema } from 'effect';
import { archiveWorkspace } from '../archives/archive-workspace.ts';
import type { ArchiveWorkspaceInput } from '../archives/archive-workspace.ts';
import { restoreWorkspace } from '../archives/restore-workspace.ts';
import { WorkspaceFailed } from '../errors.ts';
import type { ServedAnswer, WorkspaceFilesInput, WorkspaceRequest } from '../types.ts';
import { readWorkspaceBody } from './read-workspace-body.ts';

type WorkspaceOperationInput = WorkspaceFilesInput &
  WorkspaceRequest &
  Pick<ArchiveWorkspaceInput, 'ownedProcessGroups' | 'retainFreeze'>;

/** Archive transfer metadata uses the decoded record form on the guest wire. */
const ArchiveRecord = Schema.toType(SandboxArchive);
const ArchiveBody = Schema.fromJsonString(ArchiveRecord);

/** Runs an archive or restore job and returns its completed guest response. */
export const workspaceOperation = Effect.fn('workspaceOperation')(function* (
  input: WorkspaceOperationInput,
): Effect.fn.Return<ServedAnswer, WorkspaceFailed> {
  const { generation, step } = input;

  switch (step) {
    case WorkspaceStep.Archive:
      return yield* new WorkspaceFailed({ generation, step, reason: 'the bare archive route is no longer supported' });
    case WorkspaceStep.Checkpoint:
      return yield* answerArchive(input);
    case WorkspaceStep.Part:
    case WorkspaceStep.Release:
    case WorkspaceStep.Restore:
      break;
  }

  const body = yield* readWorkspaceBody(input);
  const text = body.toString('utf8');

  const archive = yield* Schema.decodeUnknownEffect(ArchiveBody)(text).pipe(
    Effect.mapError((failure) => new WorkspaceFailed({ generation, step, reason: failure.message })),
  );

  yield* restoreWorkspace({ ...input, archive });

  return { status: HttpStatusCode.Ok, headers: {}, body: '' };
});

const answerArchive = Effect.fn('answerArchive')(function* (
  input: WorkspaceOperationInput,
): Effect.fn.Return<ServedAnswer, WorkspaceFailed> {
  const archive = yield* archiveWorkspace(input);
  const body = Schema.encodeSync(ArchiveBody)(archive);

  return { status: HttpStatusCode.Ok, headers: { [HttpHeader.ContentType]: MediaType.Json }, body };
});
