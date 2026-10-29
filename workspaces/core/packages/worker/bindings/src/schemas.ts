import {
  IdentitySubjectsVariable,
  IntegrationSecretsVariable,
  ModelOffersVariable,
  RateLimitsVariable,
  SecureOrigin,
  SlackInstallationsVariable,
  WORKER_VARIABLES,
} from '@mechane/deployment';
import { WorkspaceIdsVariable } from '@mechane/protocol';
import { GitHubClientId } from '@mechane/records';
import { Duration, Schema } from 'effect';
import { KEY_LIFETIME_MAX } from './constants.ts';

/** A key lifetime as a variable writes it: whole seconds, at most the declared maximum. */
const KeyLifetimeSeconds = Schema.NumberFromString.check(
  Schema.isInt(),
  Schema.isGreaterThan(0),
  Schema.isLessThanOrEqualTo(Duration.toSeconds(KEY_LIFETIME_MAX)),
);

/** An amount of micro-dollars as a variable writes it, such as a day's allowance. */
const MicrosVariable = Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

/** The pause the CLI keeps between two polls of a device approval, in whole seconds as a variable writes it. */
const PollIntervalSeconds = Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

/**
 * The Worker's variables, under the names the deployment configuration and `.dev.vars` give them. The deployment's
 * secret store supplies the GitHub client secret, which stays redacted, and every origin a key, a cookie or that secret
 * goes to is HTTPS outside a loopback stack.
 */
export const WorkerVariables = Schema.Struct({
  /** Omission means no integration credentials are configured for any workspace. */
  integrationSecrets: Schema.OptionFromOptionalKey(IntegrationSecretsVariable),
  /** Absent when no Slack installations are configured. */
  slackInstallations: Schema.OptionFromOptionalKey(SlackInstallationsVariable),
  workerRevision: Schema.NonEmptyString,
  origin: SecureOrigin,
  githubWebOrigin: SecureOrigin,
  githubApiOrigin: SecureOrigin,
  /** Absent when GitHub sign-in is not configured. */
  githubClientId: Schema.OptionFromOptionalKey(GitHubClientId),
  /** Absent when this deployment cannot exchange a GitHub authorization code. */
  githubClientSecret: Schema.OptionFromOptionalKey(Schema.RedactedFromValue(Schema.NonEmptyString)),
  /** Absent when local owner sign-in is disabled. */
  localBootstrapSecret: Schema.OptionFromOptionalKey(Schema.RedactedFromValue(Schema.NonEmptyString)),
  /** Omission admits every verified identity; an empty list admits nobody. */
  allowedIdentities: Schema.OptionFromOptionalKey(IdentitySubjectsVariable),
  /** Omission grants nobody authority to create a shared workspace. */
  administratorIdentities: Schema.OptionFromOptionalKey(IdentitySubjectsVariable),
  dailyAllowanceMicros: MicrosVariable,
  mechDailyCapMicros: MicrosVariable,
  loginKeyLifetimeSeconds: KeyLifetimeSeconds,
  namedKeyLifetimeSeconds: KeyLifetimeSeconds,
  approvalPollIntervalSeconds: PollIntervalSeconds,
  modelOffers: ModelOffersVariable,
  rateLimits: RateLimitsVariable,
  suspendedWorkspaces: WorkspaceIdsVariable,
}).pipe(Schema.encodeKeys(WORKER_VARIABLES));

export type WorkerVariables = typeof WorkerVariables.Type;
