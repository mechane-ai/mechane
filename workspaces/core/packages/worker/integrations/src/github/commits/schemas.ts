import { GitCommit, renamedWireStruct, SourceFileMode } from '@mechane/records';
import { Schema } from 'effect';
import { GitHubObjectType } from './constants.ts';

/** A tree entry retains the provider's mode and kind for protected-file validation. */
export const GitHubTreeEntry = Schema.Struct({
  path: Schema.String,
  mode: Schema.String,
  type: Schema.String,
  sha: GitCommit,
});

export type GitHubTreeEntry = typeof GitHubTreeEntry.Type;

/** A recursive tree must be complete before a source patch can be validated. */
export const GitHubTree = renamedWireStruct({
  fields: { sha: GitCommit, isTruncated: Schema.Boolean, tree: Schema.Array(GitHubTreeEntry) },
  renames: { isTruncated: 'truncated' },
});

export type GitHubTree = typeof GitHubTree.Type;

/** GitHub represents a deletion with a null SHA while retaining the blob's file mode. */
export const GitHubTreeChange = Schema.Struct({
  path: Schema.String,
  mode: Schema.Enum(SourceFileMode),
  type: Schema.Literal(GitHubObjectType.Blob),
  /** None deletes the path from the resulting tree. */
  sha: Schema.OptionFromNullOr(GitCommit),
});

export type GitHubTreeChange = typeof GitHubTreeChange.Type;
