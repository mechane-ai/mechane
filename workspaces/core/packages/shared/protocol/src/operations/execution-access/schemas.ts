import {
  boundedText,
  BYTES_PER_KIBIBYTE,
  EXECUTION_VARIABLE_NAME_PATTERN,
  RecordText,
  wireStruct,
} from '@mechane/records';
import { Schema } from 'effect';
import { IntegrationSecretReference } from '../connections/schemas.ts';
import { GITHUB_REPOSITORY_FIELDS, GITHUB_REPOSITORY_RECORD_FIELDS } from '../github-repository-fields.ts';
import { RequestService, RequestServiceRecord } from './request-service.ts';

const VARIABLE_MAX_BYTES = 4 * BYTES_PER_KIBIBYTE;

/** Repository identity and the server-held GitHub App credential used to mint installation tokens. */
export const GitHubRepositoryAccess = wireStruct({ fields: GITHUB_REPOSITORY_FIELDS });

export type GitHubRepositoryAccess = typeof GitHubRepositoryAccess.Type;

const RESERVED_VARIABLES: ReadonlySet<string> = new Set([
  'HOME',
  'PATH',
  'SHELL',
  'BASH_ENV',
  'ENV',
  'NODE_OPTIONS',
  'LD_PRELOAD',
  'LD_LIBRARY_PATH',
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GH_HOST',
  'GIT_ASKPASS',
  'SSH_ASKPASS',
]);

const GIT_IDENTITY_VARIABLES: ReadonlySet<string> = new Set([
  'GIT_AUTHOR_NAME',
  'GIT_AUTHOR_EMAIL',
  'GIT_COMMITTER_NAME',
  'GIT_COMMITTER_EMAIL',
]);

/** Owner configuration cannot replace the guest's startup, trust, or Git credential handling. */
const EnvironmentName = Schema.String.check(
  Schema.isPattern(EXECUTION_VARIABLE_NAME_PATTERN),
  Schema.makeFilter(
    (name) => {
      if (GIT_IDENTITY_VARIABLES.has(name)) {
        return true;
      }

      const isRuntimeOwned = name.startsWith('GIT_') || name.startsWith('MECHANE_');

      return !RESERVED_VARIABLES.has(name) && !isRuntimeOwned;
    },
    { expected: 'an application environment variable' },
  ),
);

/** Values are public configuration; secret references resolve only inside the trusted runtime. */
export const ExecutionAccess = wireStruct({
  fields: {
    /** None supplies no GitHub token; the wire carries null. */
    github: Schema.OptionFromNullOr(GitHubRepositoryAccess),
    variables: Schema.Record(EnvironmentName, boundedText({ maxBytes: VARIABLE_MAX_BYTES })),
    secrets: Schema.Record(EnvironmentName, IntegrationSecretReference),
    /** None leaves external access requests unavailable; its credential is never injected into a command. */
    requestService: Schema.OptionFromOptionalNullOr(RequestService),
  },
});

export type ExecutionAccess = typeof ExecutionAccess.Type;

/** An owner change applies current request limits to the entire replacement grant. */
export const ExecutionAccessChange = Schema.Struct({
  /** Null revokes access for subsequent commands. */
  access: Schema.OptionFromNullOr(ExecutionAccess),
});

export type ExecutionAccessChange = typeof ExecutionAccessChange.Type;

const GitHubRepositoryRecord = wireStruct({ fields: GITHUB_REPOSITORY_RECORD_FIELDS });

/** Stored authority remains readable after future request limits change. */
export const ExecutionAccessRecord = wireStruct({
  fields: {
    /** None means no GitHub authority was granted. */
    github: Schema.OptionFromNullOr(GitHubRepositoryRecord),
    variables: Schema.Record(RecordText, RecordText),
    secrets: Schema.Record(RecordText, RecordText),
    /** None means no request service was configured, including grants saved before this field existed. */
    requestService: Schema.OptionFromOptionalNullOr(RequestServiceRecord),
  },
});

/** Reads expose public values and secret references only. */
export const ExecutionAccessState = Schema.Struct({
  /** None means no execution access is granted; forks and drones inherit none. */
  access: Schema.OptionFromNullOr(ExecutionAccessRecord),
});

export type ExecutionAccessState = typeof ExecutionAccessState.Type;
