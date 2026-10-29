import type { SourceGrant } from '@mechane/protocol';

type SourceRepositoryPathInput = { readonly grant: SourceGrant };

/** The granted owner and repository form the human-readable repository identity. */
export function sourceRepositoryPath({ grant }: SourceRepositoryPathInput): string {
  return `${grant.owner}/${grant.repository}`;
}
