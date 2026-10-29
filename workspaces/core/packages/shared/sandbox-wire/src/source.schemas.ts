import { GitCommit, SOURCE_PATCH_MAX_FILES, SourceChanges, SourceId, SourcePath } from '@mechane/records';
import { Schema } from 'effect';
import { SourceFencePhase } from './source.constants.ts';

const SOURCE_MESSAGE_MAX_CHARS = 1024;
const SOURCE_URL_MAX_CHARS = 4096;
const SourceMessage = Schema.String.check(Schema.isMaxLength(SOURCE_MESSAGE_MAX_CHARS));
const SourceRepositoryUrl = Schema.String.check(Schema.isMaxLength(SOURCE_URL_MAX_CHARS));

/** The trusted owner fixes the repository and commit before a guest is prepared. */
export const SourceCheckout = Schema.Struct({
  sourceId: SourceId,
  generation: SourceId,
  repositoryUrl: SourceRepositoryUrl,
  commit: GitCommit,
});

export type SourceCheckout = typeof SourceCheckout.Type;

/** Credentials cross this private RPC only after the fresh guest fence persists their exact expiry. */
export const SourceClone = Schema.Struct({
  ...SourceCheckout.fields,
  token: Schema.RedactedFromValue(Schema.NonEmptyString),
  expiresAt: Schema.DateTimeUtcFromMillis,
});

export type SourceClone = typeof SourceClone.Type;

/** Capture names owner-selected paths and the server-pinned original commit. */
export const SourceCapture = Schema.Struct({
  sourceId: SourceId,
  commit: GitCommit,
  paths: Schema.Array(SourcePath).check(Schema.isMaxLength(SOURCE_PATCH_MAX_FILES)),
});

export type SourceCapture = typeof SourceCapture.Type;

/** Public progress exposes fence state without carrying the installation token. */
export const SourceFenceReport = Schema.Struct({
  sourceId: SourceId,
  generation: SourceId,
  phase: Schema.Enum(SourceFencePhase),
  /** Absent until a token is durably admitted for this generation. */
  expiresAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
  /** Absent when there is no unresolved failure or recovery diagnostic. */
  reason: Schema.OptionFromNullOr(SourceMessage),
});

export type SourceFenceReport = typeof SourceFenceReport.Type;

/** Guest replies carry bounded diagnostics or file bytes, never GitHub credentials. */
export const SourceGuestAnswer = Schema.TaggedUnion({
  Ready: {},
  Pending: {},
  Failed: { reason: SourceMessage },
  Changes: { changes: SourceChanges },
});

export type SourceGuestAnswer = typeof SourceGuestAnswer.Type;
