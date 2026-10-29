import {
  MachinesVariable,
  RateLimitsVariable,
  SandboxEgress,
  SandboxProvider,
  WORKER_VARIABLES,
} from '@mechane/deployment';
import { SandboxWorkspacesVariable, WorkspaceIdsVariable } from '@mechane/protocol';
import { renamedWireStruct, wireStruct } from '@mechane/records';
import { Record, Schema, Struct } from 'effect';

const EnvironmentName = Schema.String.check(Schema.isPattern(/^[A-Z][A-Z0-9_]*$/));

/** The references select environment variables, never credential values. */
export const SecretReferences = Schema.Struct({
  [WORKER_VARIABLES.githubClientSecret]: EnvironmentName,
  [WORKER_VARIABLES.modelApiKey]: EnvironmentName,
  /** Absent when the installation has no Tensorlake machines. */
  [WORKER_VARIABLES.tensorlakeApiKey]: Schema.optionalKey(EnvironmentName),
  /** Absent when no configured integration uses private credentials. */
  [WORKER_VARIABLES.integrationSecrets]: Schema.optionalKey(EnvironmentName),
});

export type SecretReferences = typeof SecretReferences.Type;

const VariableNames = Struct.omit(WORKER_VARIABLES, [
  'workerRevision',
  'githubClientSecret',
  'localBootstrapSecret',
  'modelApiKey',
  'integrationSecrets',
  'tensorlakeApiKey',
  'tensorlakeImage',
  'hostLauncherOrigin',
  'hostLauncherKey',
]);

const ResourceName = Schema.String.check(Schema.isPattern(/^[a-z0-9][a-z0-9-]*$/));

const ResourceBinding = { Releases: 'RELEASES', WorkspaceFiles: 'WORKSPACE_FILES' } as const;

const CpuLimit = Schema.Int.pipe(Schema.decodeTo(Schema.DurationFromMillis));

const InstallationVariables = renamedWireStruct({
  fields: {
    ...Record.map(VariableNames, () => Schema.optionalKey(Schema.String)),
    origin: Schema.NonEmptyString,
    githubClientId: Schema.NonEmptyString,
    modelUpstream: Schema.NonEmptyString,
    modelOffers: Schema.NonEmptyString,
    sandboxProvider: Schema.Literals([SandboxProvider.Container, SandboxProvider.Tensorlake]),
    sandboxEgress: Schema.optionalKey(Schema.Literal(SandboxEgress.Gateway)),
    sandboxWorkspaces: SandboxWorkspacesVariable,
    workspaceMachines: MachinesVariable,
    suspendedWorkspaces: WorkspaceIdsVariable,
    rateLimits: RateLimitsVariable,
  },
  renames: VariableNames,
});

/** Installation-owned resources overlay the product's stable bindings and migrations. */
export const InstallationConfiguration = wireStruct({
  fields: {
    name: ResourceName,
    isWorkersDev: Schema.Boolean,
    hasPreviewUrls: Schema.Boolean,
    routes: Schema.Array(
      wireStruct({ fields: { pattern: Schema.NonEmptyString, isCustomDomain: Schema.Literal(true) } }),
    ),
    r2Buckets: Schema.Tuple([
      wireStruct({ fields: { binding: Schema.Literal(ResourceBinding.Releases), bucketName: ResourceName } }),
      wireStruct({ fields: { binding: Schema.Literal(ResourceBinding.WorkspaceFiles), bucketName: ResourceName } }),
    ]),
    limits: renamedWireStruct({ fields: { cpu: CpuLimit }, renames: { cpu: 'cpu_ms' } }),
    observability: renamedWireStruct({
      fields: {
        isEnabled: Schema.Literal(true),
        headSamplingRate: Schema.Number,
        isQueryStringRedacted: Schema.Literal(true),
        logs: renamedWireStruct({
          fields: {
            isEnabled: Schema.Boolean,
            includeInvocationLogs: Schema.Boolean,
            headSamplingRate: Schema.Number,
            isPersisted: Schema.Boolean,
          },
          renames: { includeInvocationLogs: 'invocation_logs', isPersisted: 'persist' },
        }),
      },
      renames: { isQueryStringRedacted: 'redact_query_string' },
    }),
    /** Absent when the installation creates no container machines. */
    container: Schema.optionalKey(
      wireStruct({
        fields: {
          name: ResourceName,
          instanceType: Schema.NonEmptyString,
          maxInstances: Schema.Int.check(Schema.isGreaterThan(0)),
        },
      }),
    ),
    /** Absent when the installation has no Tensorlake image namespace. */
    tensorlakeImagePrefix: Schema.optionalKey(ResourceName),
    secretRefs: SecretReferences,
    vars: InstallationVariables,
  },
});

export type InstallationConfiguration = typeof InstallationConfiguration.Type;

/** The installation file's wire keys before decoding into the renderer's configuration. */
export type InstallationOverlay = typeof InstallationConfiguration.Encoded;
