import { HttpStatusCode } from '@mechane/records';
import { Effect } from 'effect';
import { mkdir, writeFile } from 'node:fs/promises';
import { WorkspaceFailed } from '../errors.ts';
import type { ServedAnswer, WorkspaceRequest } from '../types.ts';
import { readWorkspaceBody } from '../workspace/read-workspace-body.ts';
import { workspaceFilePath } from '../workspace/workspace-file-path.ts';
import { archivePartName } from './archive-part-name.ts';

type WriteWorkspacePartInput = WorkspaceRequest & { readonly folder: string };

/** Stores one bounded restore part under its workspace generation. */
export const writeWorkspacePart = Effect.fn('writeWorkspacePart')(function* (
  input: WriteWorkspacePartInput,
): Effect.fn.Return<ServedAnswer, WorkspaceFailed> {
  const { folder, generation, part, step } = input;
  const name = archivePartName({ part });
  const directory = workspaceFilePath({ folder, generation, file: '' });
  const path = workspaceFilePath({ folder, generation, file: name });
  const body = yield* readWorkspaceBody(input);

  yield* Effect.tryPromise({
    try: () => mkdir(directory, { recursive: true }),
    catch: (cause) => new WorkspaceFailed({ generation, step, reason: String(cause) }),
  });
  yield* Effect.tryPromise({
    try: () => writeFile(path, body),
    catch: (cause) => new WorkspaceFailed({ generation, step, reason: String(cause) }),
  });

  return { status: HttpStatusCode.Ok, headers: {}, body: '' };
});
