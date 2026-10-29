import type { SourceGrant } from '@mechane/protocol';
import { Option } from 'effect';
import { githubRepositoryPath } from './github-repository-path.ts';

type GitHubReferencePathInput = {
  readonly grant: SourceGrant;
  /** None denotes reference creation; a branch addresses an existing head. */
  readonly branch: Option.Option<string>;
};

/** Encodes the complete branch name so its slash remains part of the reference. */
export function githubReferencePath({ grant, branch }: GitHubReferencePathInput): string {
  if (Option.isNone(branch)) {
    return githubRepositoryPath({ grant, suffix: '/git/refs' });
  }

  const reference = encodeURIComponent(branch.value);
  const path = githubRepositoryPath({ grant, suffix: '/git/ref/heads' });

  return `${path}/${reference}`;
}
