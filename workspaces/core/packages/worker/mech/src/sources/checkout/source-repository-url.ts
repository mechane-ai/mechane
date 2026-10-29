import type { SourceGrant } from '@mechane/protocol';

type SourceRepositoryUrlInput = { readonly origin: URL; readonly grant: SourceGrant };

/** Repository names are validated in the owner grant; credentials never enter its remote URL. */
export function sourceRepositoryUrl({ origin, grant }: SourceRepositoryUrlInput): string {
  const path = cloneRepositoryPath({ grant });
  const url = new URL(path, origin);

  return url.href;
}

type CloneRepositoryPathInput = { readonly grant: SourceGrant };

function cloneRepositoryPath({ grant }: CloneRepositoryPathInput): string {
  return `/${grant.owner}/${grant.repository}.git`;
}
