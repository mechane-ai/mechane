import { HttpMethod, SourceFileMode } from '@mechane/records';
import type { SourceChange } from '@mechane/records';
import { Option, Result } from 'effect';
import type { GitHubFailed } from '../errors.ts';
import { githubBlobPath } from '../paths/github-blob-path.ts';
import { requestGitHub } from '../requests/request-github.ts';
import { GitHubObject } from '../schemas.ts';
import type { GitHubRepositoryInput } from '../types.ts';
import { GitHubObjectType } from './constants.ts';
import type { GitHubTreeChange } from './schemas.ts';

type CreateSourceBlobInput = GitHubRepositoryInput & { readonly change: SourceChange };

/** Deletions create no blob; file content is uploaded only after the whole patch has passed validation. */
export async function createSourceBlob({
  origin,
  token,
  grant,
  change,
}: CreateSourceBlobInput): Promise<Result.Result<GitHubTreeChange, GitHubFailed>> {
  if (Option.isNone(change.base64) || Option.isNone(change.mode)) {
    const sha = Option.none();

    return Result.succeed({ path: change.path, mode: SourceFileMode.File, type: GitHubObjectType.Blob, sha });
  }

  const path = githubBlobPath({ grant });
  const body = Option.some({ content: change.base64.value, encoding: 'base64' });
  const blob = await requestGitHub({ origin, token, path, method: HttpMethod.Post, body, schema: GitHubObject });

  if (Result.isFailure(blob)) {
    return Result.fail(blob.failure);
  }

  const sha = Option.some(blob.success.sha);

  return Result.succeed({ path: change.path, mode: change.mode.value, type: GitHubObjectType.Blob, sha });
}
