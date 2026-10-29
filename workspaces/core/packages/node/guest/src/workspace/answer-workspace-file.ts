import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Effect } from 'effect';
import { rm } from 'node:fs/promises';
import { readWorkspacePart } from '../archive-files/read-workspace-part.ts';
import { writeWorkspacePart } from '../archive-files/write-workspace-part.ts';
import { WorkspaceFailed } from '../errors.ts';
import type { ExecutionLedger, ServedAnswer, WorkspaceRequest } from '../types.ts';
import { workspaceFilePath } from './workspace-file-path.ts';

type AnswerWorkspaceFileInput = WorkspaceRequest & { readonly folder: string; readonly ledger: ExecutionLedger };

/** Transfers one part or removes a completed generation and releases command execution. */
export const answerWorkspaceFile = Effect.fn('answerWorkspaceFile')(function* (
  input: AnswerWorkspaceFileInput,
): Effect.fn.Return<ServedAnswer, WorkspaceFailed> {
  const { generation, step, folder, ledger, request, part } = input;

  if (step === WorkspaceStep.Release) {
    const path = workspaceFilePath({ folder, generation, file: '' });

    yield* Effect.tryPromise({
      try: () => rm(path, { recursive: true, force: true }),
      catch: (cause) => new WorkspaceFailed({ generation, step, reason: String(cause) }),
    });

    ledger.resume();

    return { status: HttpStatusCode.Ok, headers: {}, body: '' };
  }

  if (!ledger.quiesce()) {
    return { status: HttpStatusCode.NoContent, headers: {}, body: '' };
  }

  if (request.method === HttpMethod.Put) {
    return yield* writeWorkspacePart(input);
  }

  const body = yield* readWorkspacePart({ folder, generation, part });

  return { status: HttpStatusCode.Ok, headers: { [HttpHeader.ContentType]: MediaType.OctetStream }, body };
});
