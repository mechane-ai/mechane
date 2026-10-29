import type { SourceId } from '@mechane/records';

type SourceDirectoryPathInput = { readonly sourceId: SourceId };

/** The stable checkout path presented to its owner and model. */
export function sourceDirectoryPath({ sourceId }: SourceDirectoryPathInput): string {
  return `sources/${sourceId}`;
}
