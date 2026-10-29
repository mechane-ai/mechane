import type { SourceGrant } from '@mechane/protocol';

type GitHubPathInput = { readonly grant: SourceGrant; readonly suffix: string };

/** Encodes the owner and repository independently before appending an owned endpoint suffix. */
export function githubRepositoryPath({ grant, suffix }: GitHubPathInput): string {
  const owner = encodeURIComponent(grant.owner);
  const repository = encodeURIComponent(grant.repository);

  return `/repos/${owner}/${repository}${suffix}`;
}
