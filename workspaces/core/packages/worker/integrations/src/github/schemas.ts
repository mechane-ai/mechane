import { GitCommit } from '@mechane/records';
import { Schema } from 'effect';

/** The object identity returned by GitHub's Git database endpoints. */
export const GitHubObject = Schema.Struct({ sha: GitCommit });

export type GitHubObject = typeof GitHubObject.Type;
