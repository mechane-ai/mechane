import type { SourceId } from '@mechane/records';

type SourceBranchNameInput = { readonly sourceId: SourceId; readonly isQualified: boolean };

/** A deterministic source-owned branch, optionally qualified for Git reference creation. */
export function sourceBranchName({ sourceId, isQualified }: SourceBranchNameInput): string {
  if (isQualified) {
    return qualifiedSourceBranchName({ sourceId });
  }

  return `mechane/${sourceId}`;
}

function qualifiedSourceBranchName({ sourceId }: Pick<SourceBranchNameInput, 'sourceId'>): string {
  return `refs/heads/mechane/${sourceId}`;
}
