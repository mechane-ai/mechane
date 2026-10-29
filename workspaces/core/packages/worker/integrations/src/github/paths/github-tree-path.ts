import type { SourceGrant } from '@mechane/protocol';
import { Option } from 'effect';
import { githubRepositoryPath } from './github-repository-path.ts';

type GitHubTreePathInput = {
  readonly grant: SourceGrant;
  /** None denotes tree creation; a tree identity requests its recursive contents. */
  readonly tree: Option.Option<string>;
};

/** Tree reads include descendants so protected ancestors can be checked before writes. */
export function githubTreePath({ grant, tree }: GitHubTreePathInput): string {
  const path = githubRepositoryPath({ grant, suffix: '/git/trees' });

  if (Option.isNone(tree)) {
    return path;
  }

  const revision = encodeURIComponent(tree.value);

  return `${path}/${revision}?recursive=1`;
}
