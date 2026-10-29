import { ModelOffersVariable, OriginProtocol, SandboxProvider, WORKER_VARIABLES } from '@mechane/deployment';
import { Release, SandboxWorkspacesVariable } from '@mechane/protocol';
import { renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { DeployMode, TAG_PREFIX } from './constants.ts';

/** A URL that only TLS reaches, which every origin a production variable names must be. */
const HttpsUrl = Schema.URLFromString.check(
  Schema.makeFilter((url) => url.protocol === OriginProtocol.Secure, { expected: `an ${OriginProtocol.Secure} URL` }),
  Schema.makeFilter((url) => url.username === '' && url.password === '', { expected: 'a URL without credentials' }),
  Schema.makeFilter((url) => url.search === '' && url.hash === '', { expected: 'a URL without a query or a fragment' }),
);

/** Cloud variables require HTTPS origins and a hosted machine provider, and never contain secrets or local access. */
export const ProductionVariables = Schema.Struct({
  origin: HttpsUrl,
  githubWebOrigin: HttpsUrl,
  githubApiOrigin: HttpsUrl,
  modelUpstream: HttpsUrl,
  githubClientId: Schema.NonEmptyString,
  modelOffers: ModelOffersVariable,
  sandboxProvider: Schema.Literals([SandboxProvider.Tensorlake, SandboxProvider.Container]),
  /** Absent when the installation has no Tensorlake machines. */
  tensorlakeImage: Schema.optionalKey(Schema.NonEmptyString),
  /** Always absent: the deploy uploads the secret, which no variable holds. */
  tensorlakeApiKey: Schema.optionalKey(Schema.Never),
  sandboxWorkspaces: SandboxWorkspacesVariable,
  /** Always absent: the deploy uploads the secret, which no variable holds. */
  githubClientSecret: Schema.optionalKey(Schema.Never),
  /** Always absent: the deploy uploads the secret, which no variable holds. */
  modelApiKey: Schema.optionalKey(Schema.Never),
  /** Always absent: integration credentials are uploaded as a Worker secret. */
  integrationSecrets: Schema.optionalKey(Schema.Never),
  /** Always absent: local owner bootstrap is unavailable on cloud installations. */
  localBootstrapSecret: Schema.optionalKey(Schema.Never),
  /** Always absent: only a local stack serves a host launcher. */
  hostLauncherOrigin: Schema.optionalKey(Schema.Never),
  /** Always absent: only a local stack serves a host launcher. */
  hostLauncherKey: Schema.optionalKey(Schema.Never),
}).pipe(Schema.encodeKeys(WORKER_VARIABLES));

export type ProductionVariables = typeof ProductionVariables.Type;

/** The id Cloudflare gives each version of a Worker, a UUID, which a deployment sends a share of traffic. */
export const WorkerVersionId = Schema.String.check(Schema.isUUID()).pipe(Schema.brand('WorkerVersionId'));

export type WorkerVersionId = typeof WorkerVersionId.Type;

/** Absent lets the environment select the installation, with an example fallback only for rendering. */
const ConfigurationFlag = Schema.OptionFromOptionalKey(Schema.NonEmptyString);

/** The command line, by mode: only a rollback names its target. */
export const Invocation = Schema.Union([
  renamedWireStruct({
    fields: { mode: Schema.Literal(DeployMode.Render), configuration: ConfigurationFlag },
    renames: { configuration: 'config' },
  }),
  renamedWireStruct({
    fields: { mode: Schema.Literal(DeployMode.Preflight), configuration: ConfigurationFlag },
    renames: { configuration: 'config' },
  }),
  renamedWireStruct({
    fields: { mode: Schema.Literal(DeployMode.Deploy), configuration: ConfigurationFlag },
    renames: { configuration: 'config' },
  }),
  renamedWireStruct({
    fields: { mode: Schema.Literal(DeployMode.Upload), configuration: ConfigurationFlag },
    renames: { configuration: 'config' },
  }),
  renamedWireStruct({
    fields: { mode: Schema.Literal(DeployMode.Rollback), configuration: ConfigurationFlag, versionId: WorkerVersionId },
    renames: { versionId: 'to', configuration: 'config' },
  }),
]);

export type Invocation = typeof Invocation.Type;

const SecretText = Schema.Redacted(Schema.NonEmptyString);

/** Credentials are redacted before validation; model keys have no provider-specific format. */
export const Credentials = Schema.Struct({
  cloudflareApiToken: SecretText,
  cloudflareAccountId: Schema.Redacted(Schema.String.check(Schema.isPattern(/^[0-9a-f]{32}$/))),
  secrets: Schema.Struct({
    [WORKER_VARIABLES.githubClientSecret]: SecretText,
    [WORKER_VARIABLES.modelApiKey]: SecretText,
    /** Absent when the installation has no Tensorlake machines. */
    [WORKER_VARIABLES.tensorlakeApiKey]: Schema.optionalKey(SecretText),
    /** Absent when no configured integration uses private credentials. */
    [WORKER_VARIABLES.integrationSecrets]: Schema.optionalKey(SecretText),
  }),
});

export type Credentials = typeof Credentials.Type;

/** The Worker secrets uploaded together with its code. */
export const SecretsFile = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));

export type SecretsFile = typeof SecretsFile.Type;

/** A release's tag, as git and a Worker version carry it, decoded into its prefix and the release it names. */
export const ReleaseTag = Schema.TemplateLiteralParser([TAG_PREFIX, Release]);

export type ReleaseTag = typeof ReleaseTag.Type;
