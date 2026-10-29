import type { SourceTask } from '@mechane/mech-store';
import { SourceReport } from '@mechane/protocol';
import { Option } from 'effect';
import { sourceDirectoryPath } from './source-directory-path.ts';
import { sourceRepositoryPath } from './source-repository-path.ts';

type SourceSummaryInput = { readonly source: SourceTask };

/** Owner reports expose progress and diagnostics while withholding captured content and credentials. */
export function sourceSummary({ source }: SourceSummaryInput): SourceReport {
  const publicationStatus = Option.map(source.publication, (publication) => publication.status);
  const pullRequestUrl = Option.flatMap(source.publication, (publication) => publication.pullRequestUrl);
  const publicationReason = Option.flatMap(source.publication, (publication) => publication.reason);
  const reason = Option.orElse(publicationReason, () => source.reason);

  const repository = sourceRepositoryPath({ grant: source.grant });
  const directory = sourceDirectoryPath({ sourceId: source.sourceId });

  return SourceReport.cases.Progress.make({
    source: {
      sourceId: source.sourceId,
      repository,
      commit: source.commit,
      directory,
      status: source.status,
      publicationStatus,
      pullRequestUrl,
      reason,
    },
  });
}
