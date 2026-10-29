import type { SourceGrant } from '@mechane/protocol';

type GitHubPullPathInput = { readonly grant: SourceGrant; readonly number: number };
type GitHubPullUrlInput = GitHubPullPathInput & { readonly webOrigin: URL };

/** Uses the configured web origin rather than trusting a provider-returned URL. */
export function githubPullUrl({ grant, number, webOrigin }: GitHubPullUrlInput): string {
  const path = githubPullPath({ grant, number });
  const url = new URL(path, webOrigin);

  return url.href;
}

function githubPullPath({ grant, number }: GitHubPullPathInput): string {
  const owner = encodeURIComponent(grant.owner);
  const repository = encodeURIComponent(grant.repository);

  return `/${owner}/${repository}/pull/${number}`;
}
