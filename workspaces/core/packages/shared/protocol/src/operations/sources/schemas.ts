import {
  GitCommit,
  RecordName,
  RecordText,
  SOURCE_GRANT_MAX_PATHS,
  SOURCE_PATCH_MAX_FILES,
  SourceId,
  SourcePath,
  SourcePathPrefix,
  wireStruct,
} from '@mechane/records';
import { Schema } from 'effect';
import { IntegrationSecretReference } from '../connections/schemas.ts';
import { SourceAction, SourcePublicationStatus, SourceStatus } from './constants.ts';

const GITHUB_NAME_MAX_CHARS = 100;
const GIT_BRANCH_MAX_CHARS = 200;

const GitHubName = Schema.NonEmptyString.check(
  Schema.isMaxLength(GITHUB_NAME_MAX_CHARS),
  Schema.isPattern(/^[a-zA-Z0-9_.-]+$/u),
);

const GitHubIdentifier = Schema.Int.check(Schema.isGreaterThan(0));

const SOURCE_DESCRIPTION_MAX_CHARS = 16_384;
const SourceDescription = Schema.String.check(Schema.isMaxLength(SOURCE_DESCRIPTION_MAX_CHARS));

const GitBranch = Schema.NonEmptyString.check(
  Schema.isMaxLength(GIT_BRANCH_MAX_CHARS),
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/u),
);

/**
 * Owner approval fixes the repository identity, publication base, writable paths, and workspace-scoped credential
 * reference.
 */
export const SourceGrant = wireStruct({
  fields: {
    appId: GitHubIdentifier,
    installationId: GitHubIdentifier,
    repositoryId: GitHubIdentifier,
    owner: GitHubName,
    repository: GitHubName,
    baseBranch: GitBranch,
    secretReference: IntegrationSecretReference,
    writePaths: Schema.Array(SourcePathPrefix).check(Schema.isBetweenLength(1, SOURCE_GRANT_MAX_PATHS)),
  },
});

export type SourceGrant = typeof SourceGrant.Type;

/** Owners select distinct changed paths before an immutable publication intent captures their contents. */
export const SourcePublishPaths = Schema.Array(SourcePath).check(
  Schema.isBetweenLength(1, SOURCE_PATCH_MAX_FILES),
  Schema.makeFilter((paths) => new Set(paths).size === paths.length, { expected: 'distinct changed paths' }),
);

export type SourcePublishPaths = typeof SourcePublishPaths.Type;

/** Checkout and publication retries reuse their source identifier and must preserve the recorded intent. */
export const SourceRequest = Schema.Union([
  wireStruct({
    fields: {
      action: Schema.Literal(SourceAction.Configure),
      /** Null revokes future checkout and publication authority for this mech. */
      grant: Schema.OptionFromNullOr(SourceGrant),
    },
  }),
  wireStruct({ fields: { action: Schema.Literal(SourceAction.Checkout), sourceId: SourceId, commit: GitCommit } }),
  wireStruct({
    fields: {
      action: Schema.Literal(SourceAction.Publish),
      sourceId: SourceId,
      title: RecordName,
      body: SourceDescription,
      paths: SourcePublishPaths,
    },
  }),
  wireStruct({ fields: { action: Schema.Literal(SourceAction.Show), sourceId: SourceId } }),
]);

export type SourceRequest = typeof SourceRequest.Type;

/** Progress exposes the source identity and publication result while keeping credentials outside the wire response. */
const SourceSummary = wireStruct({
  fields: {
    sourceId: SourceId,
    repository: RecordText,
    commit: GitCommit,
    directory: RecordText,
    status: Schema.Enum(SourceStatus),
    /** None means publication has not been requested; the wire carries null. */
    publicationStatus: Schema.OptionFromNullOr(Schema.Enum(SourcePublicationStatus)),
    /** None means no matching draft has been confirmed; the wire carries null. */
    pullRequestUrl: Schema.OptionFromNullOr(RecordText),
    /** None means no unresolved diagnostic was recorded; the wire carries null. */
    reason: Schema.OptionFromNullOr(RecordText),
  },
});

const SourceGrantRecord = wireStruct({
  fields: {
    appId: Schema.Number,
    installationId: Schema.Number,
    repositoryId: Schema.Number,
    owner: RecordText,
    repository: RecordText,
    baseBranch: RecordText,
    secretReference: RecordText,
    writePaths: Schema.Array(RecordText),
  },
});

/** A read distinguishes absent repository authority from a missing or inaccessible mech. */
export const SourceGrantState = Schema.Struct({
  /** None means the mech has no current repository grant; the wire carries null. */
  grant: Schema.OptionFromNullOr(SourceGrantRecord),
});

export type SourceGrantState = typeof SourceGrantState.Type;

/** Configuration responses accept saved grant values independently of current request limits. */
export const SourceReport = Schema.TaggedUnion({
  Configured: {
    /** None confirms the mech has no repository grant; the wire carries null. */
    grant: Schema.OptionFromNullOr(SourceGrantRecord),
  },
  Progress: { source: SourceSummary },
});

export type SourceReport = typeof SourceReport.Type;
