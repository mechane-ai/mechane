import { HttpMethod } from '@mechane/records';
import type { SourceChanges } from '@mechane/records';
import { Option, Result } from 'effect';
import type { GitHubFailed } from '../errors.ts';
import { githubTreePath } from '../paths/github-tree-path.ts';
import { requestGitHub } from '../requests/request-github.ts';
import { GitHubObject } from '../schemas.ts';
import type { GitHubRepositoryInput } from '../types.ts';
import { createSourceBlobs } from './create-source-blobs.ts';
import { readSourceTree } from './read-source-tree.ts';
import type { GitHubTreeChange } from './schemas.ts';
import { validateSourceChanges } from './validate-source-changes.ts';

type CreateSourceTreeInput = GitHubRepositoryInput & { readonly changes: SourceChanges; readonly baseTree: string };

type WriteSourceTreeInput = GitHubRepositoryInput & {
  readonly baseTree: string;
  readonly changes: ReadonlyArray<GitHubTreeChange>;
};

/** Builds a new Git tree from a fully validated patch without changing the base tree. */
export async function createSourceTree({
  origin,
  token,
  grant,
  changes,
  baseTree,
}: CreateSourceTreeInput): Promise<Result.Result<string, GitHubFailed>> {
  const original = await readSourceTree({ origin, token, grant, baseTree });

  if (Result.isFailure(original)) {
    return Result.fail(original.failure);
  }

  const validated = validateSourceChanges({ grant, changes, tree: original.success });

  if (Result.isFailure(validated)) {
    return Result.fail(validated.failure);
  }

  const blobs = await createSourceBlobs({ origin, token, grant, changes });

  if (Result.isFailure(blobs)) {
    return Result.fail(blobs.failure);
  }

  return await writeSourceTree({ origin, token, grant, baseTree, changes: blobs.success });
}

async function writeSourceTree({
  origin,
  token,
  grant,
  baseTree,
  changes,
}: WriteSourceTreeInput): Promise<Result.Result<string, GitHubFailed>> {
  const revision = Option.none();
  const path = githubTreePath({ grant, tree: revision });

  const encode: (change: GitHubTreeChange) => typeof GitHubTreeChange.Encoded = (change) => ({
    ...change,
    sha: Option.getOrNull(change.sha),
  });

  const tree = changes.map(encode);
  const body = Option.some({ base_tree: baseTree, tree });
  const created = await requestGitHub({ origin, token, path, method: HttpMethod.Post, body, schema: GitHubObject });

  return Result.map(created, (value) => value.sha);
}
