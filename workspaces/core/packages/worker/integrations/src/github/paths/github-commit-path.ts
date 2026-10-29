import type { SourceGrant } from '@mechane/protocol';
import { Option } from 'effect';
import { githubRepositoryPath } from './github-repository-path.ts';

type GitHubCommitPathInput = {
  readonly grant: SourceGrant;
  /** None denotes the commit-creation endpoint. */
  readonly commit: Option.Option<string>;
};

/** Addresses one immutable commit, or the collection used to create a commit. */
export function githubCommitPath({ grant, commit }: GitHubCommitPathInput): string {
  const path = githubRepositoryPath({ grant, suffix: '/git/commits' });

  if (Option.isNone(commit)) {
    return path;
  }

  const revision = encodeURIComponent(commit.value);

  return `${path}/${revision}`;
}
