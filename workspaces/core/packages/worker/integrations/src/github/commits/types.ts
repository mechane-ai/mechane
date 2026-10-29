import type { Bytes, SourceChanges, SourceId } from '@mechane/records';
import type { DateTime } from 'effect';
import type { GitHubRepositoryInput } from '../types.ts';

/** The immutable base, staged changes and provenance for a source publication. */
export type GitHubSourceInput = GitHubRepositoryInput & {
  readonly sourceId: SourceId;
  readonly baseCommit: string;
  readonly changes: SourceChanges;
  readonly title: string;
  readonly createdAt: DateTime.Utc;
};

/** Paths and decoded content bytes already accepted earlier in the same patch. */
export type SourceValidation = { readonly seen: ReadonlySet<string>; readonly totalBytes: Bytes };
