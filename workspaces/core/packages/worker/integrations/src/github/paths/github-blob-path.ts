import type { SourceGrant } from '@mechane/protocol';
import { githubRepositoryPath } from './github-repository-path.ts';

type GitHubBlobPathInput = { readonly grant: SourceGrant };

/** The Git database endpoint for immutable file content. */
export function githubBlobPath({ grant }: GitHubBlobPathInput): string {
  return githubRepositoryPath({ grant, suffix: '/git/blobs' });
}
