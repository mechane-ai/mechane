import { SourceGrant, SourcePublicationStatus, SourcePublishPaths, SourceStatus } from '@mechane/protocol';
import { GitCommit, PrincipalId, RecordName, RecordText, SourceChanges, SourceId } from '@mechane/records';
import { Schema } from 'effect';

/** The frozen publication intent survives retries without recapturing bytes or repeating a PR creation. */
export const SourcePublication = Schema.Struct({
  title: RecordName,
  body: RecordText,
  paths: SourcePublishPaths,
  createdAt: Schema.DateTimeUtcFromMillis,
  creatorId: PrincipalId,
  status: Schema.Enum(SourcePublicationStatus),
  /** Absent until the selected file capture is validated and frozen. */
  changes: Schema.OptionFromNullOr(SourceChanges),
  /** Absent until GitHub confirms the deterministic commit. */
  commit: Schema.OptionFromNullOr(GitCommit),
  hasAttemptedPull: Schema.Boolean,
  /** Absent until reconciliation confirms the matching draft. */
  pullRequestUrl: Schema.OptionFromNullOr(RecordText),
  /** Absent when no unresolved operation or credential-cleanup diagnostic remains. */
  reason: Schema.OptionFromNullOr(RecordText),
});

export type SourcePublication = typeof SourcePublication.Type;

/** Original grant and commit remain pinned even if the owner later changes repository authority. */
export const SourceTask = Schema.Struct({
  sourceId: SourceId,
  generation: SourceId,
  grant: SourceGrant,
  commit: GitCommit,
  status: Schema.Enum(SourceStatus),
  creatorId: PrincipalId,
  createdAt: Schema.DateTimeUtcFromMillis,
  /** Absent until an owner first requests publication for this checkout. */
  publication: Schema.OptionFromNullOr(SourcePublication),
  /** Absent when no unresolved operation or credential-cleanup diagnostic remains. */
  reason: Schema.OptionFromNullOr(RecordText),
});

export type SourceTask = typeof SourceTask.Type;
