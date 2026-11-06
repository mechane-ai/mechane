import { RecordText } from '@mechane/records';
import { Schema } from 'effect';
import { IntegrationSecretReference } from './connections/schemas.ts';

const GITHUB_NAME_MAX_CHARS = 100;
const PositiveIdentifier = Schema.isGreaterThan(0);
const NameLength = Schema.isMaxLength(GITHUB_NAME_MAX_CHARS);
const NamePattern = Schema.isPattern(/^[a-zA-Z0-9_.-]+$/u);
const GitHubIdentifier = Schema.Int.check(PositiveIdentifier);
const GitHubName = Schema.NonEmptyString.check(NameLength, NamePattern);

/** Owner requests identify one repository and its workspace-held issuer credential. */
export const GITHUB_REPOSITORY_FIELDS = {
  appId: GitHubIdentifier,
  installationId: GitHubIdentifier,
  repositoryId: GitHubIdentifier,
  owner: GitHubName,
  repository: GitHubName,
  secretReference: IntegrationSecretReference,
} as const;

/** Saved repository authority remains readable independently of current request limits. */
export const GITHUB_REPOSITORY_RECORD_FIELDS = {
  appId: Schema.Number,
  installationId: Schema.Number,
  repositoryId: Schema.Number,
  owner: RecordText,
  repository: RecordText,
  secretReference: RecordText,
} as const;
