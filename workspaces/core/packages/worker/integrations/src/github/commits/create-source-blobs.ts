import type { SourceChange, SourceChanges } from '@mechane/records';
import { Result } from 'effect';
import type { GitHubFailed } from '../errors.ts';
import type { GitHubRepositoryInput } from '../types.ts';
import { createSourceBlob } from './create-source-blob.ts';
import type { GitHubTreeChange } from './schemas.ts';

type CreateSourceBlobsInput = GitHubRepositoryInput & { readonly changes: SourceChanges };
type SourceBlobs = Result.Result<ReadonlyArray<GitHubTreeChange>, GitHubFailed>;

type AppendSourceBlobInput = GitHubRepositoryInput & {
  readonly change: SourceChange;
  readonly tree: ReadonlyArray<GitHubTreeChange>;
};

/** Preserves request order and stops creating blobs after the first provider failure. */
export async function createSourceBlobs({
  origin,
  token,
  grant,
  changes,
}: CreateSourceBlobsInput): Promise<SourceBlobs> {
  const tree: ReadonlyArray<GitHubTreeChange> = [];
  const state = { tree };

  for (const change of changes) {
    const appended = await appendSourceBlob({ origin, token, grant, change, tree: state.tree });

    if (Result.isFailure(appended)) {
      return appended;
    }

    state.tree = appended.success;
  }

  return Result.succeed(state.tree);
}

async function appendSourceBlob({ origin, token, grant, change, tree }: AppendSourceBlobInput): Promise<SourceBlobs> {
  const blob = await createSourceBlob({ origin, token, grant, change });

  if (Result.isFailure(blob)) {
    return Result.fail(blob.failure);
  }

  return Result.succeed([...tree, blob.success]);
}
