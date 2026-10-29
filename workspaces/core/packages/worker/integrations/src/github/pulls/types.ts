import type { SourceId } from '@mechane/records';
import type { GitHubRepositoryInput } from '../types.ts';

/** The deterministic source identity and content expected in a draft pull request. */
export type GitHubPullInput = GitHubRepositoryInput & {
  readonly sourceId: SourceId;
  readonly commit: string;
  readonly title: string;
  readonly body: string;
  readonly webOrigin: URL;
};
