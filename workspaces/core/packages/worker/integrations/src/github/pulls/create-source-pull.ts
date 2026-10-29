import { Result } from 'effect';
import type { GitHubFailed } from '../errors.ts';
import { confirmSourcePull } from './confirm-source-pull.ts';
import { submitSourcePull } from './submit-source-pull.ts';
import type { GitHubPullInput } from './types.ts';

/** Creates a draft against the approved base and accepts only the exact requested source result. */
export async function createSourcePull({ ...input }: GitHubPullInput): Promise<Result.Result<string, GitHubFailed>> {
  const created = await submitSourcePull(input);

  if (Result.isFailure(created)) {
    return Result.fail(created.failure);
  }

  return confirmSourcePull({
    source: input,
    pulls: [created.success],
    reason: 'GitHub returned a conflicting draft pull request',
  });
}
