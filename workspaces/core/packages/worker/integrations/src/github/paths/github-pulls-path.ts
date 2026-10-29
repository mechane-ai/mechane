import type { SourceGrant } from '@mechane/protocol';
import { Option } from 'effect';
import { githubRepositoryPath } from './github-repository-path.ts';

const GITHUB_PULL_PAGE_COUNT = 100;

type GitHubPullsPathInput = {
  readonly grant: SourceGrant;
  /** None denotes creation; a branch searches all pull states for reconciliation. */
  readonly branch: Option.Option<string>;
};

/** Bounds reconciliation to the exact source head and owner-approved base. */
export function githubPullsPath({ grant, branch }: GitHubPullsPathInput): string {
  const path = githubRepositoryPath({ grant, suffix: '/pulls' });

  if (Option.isNone(branch)) {
    return path;
  }

  const headName = githubPullHeadName({ grant, branch: branch.value });
  const head = encodeURIComponent(headName);
  const base = encodeURIComponent(grant.baseBranch);

  return `${path}?state=all&head=${head}&base=${base}&per_page=${GITHUB_PULL_PAGE_COUNT}`;
}

type GitHubPullHeadNameInput = { readonly grant: SourceGrant; readonly branch: string };

function githubPullHeadName({ grant, branch }: GitHubPullHeadNameInput): string {
  return `${grant.owner}:${branch}`;
}
