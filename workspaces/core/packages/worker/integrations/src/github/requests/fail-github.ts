import { Result } from 'effect';
import { GitHubFailed } from '../errors.ts';

type FailGitHubInput = { readonly status: number; readonly reason: string };

/** Keeps provider diagnostics bounded to the status and owned failure description. */
export function failGitHub({ status, reason }: FailGitHubInput): Result.Result<never, GitHubFailed> {
  const failure = new GitHubFailed({ status, reason });

  return Result.fail(failure);
}
