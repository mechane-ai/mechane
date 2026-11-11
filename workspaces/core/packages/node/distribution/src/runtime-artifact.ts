import { ArtifactDigest } from '@mechane/program';
import { Release, RELEASE_REPOSITORY } from '@mechane/protocol';
import { GitCommit, MediaType } from '@mechane/records';
import { Schema } from 'effect';
import { fileURLToPath } from 'node:url';
import { ASSET_PATTERN, FORMAT_VERSION } from './constants.ts';

const OUTPUT_URL: Readonly<URL> = new URL('../../../worker/server/.output/', import.meta.url);
const FORBIDDEN_PATH_PARTS: ReadonlySet<string> = new Set(['', '.', '..']);

export const RUNTIME_OUTPUT_FOLDER = fileURLToPath(OUTPUT_URL);
export const RUNTIME_INVENTORY_FILE = 'runtime.json';
const MIGRATION_ENTRYPOINT = 'migrate.mjs';
const GRANT_ENTRYPOINT = 'grant.mjs';
const IMPORT_ENTRYPOINT = 'import.mjs';

export const RUNTIME_REQUIRED_FILES = [
  'worker.js',
  MIGRATION_ENTRYPOINT,
  GRANT_ENTRYPOINT,
  IMPORT_ENTRYPOINT,
  'build.json',
  'console/index.html',
  'console/THIRD_PARTY_LICENSES.txt',
  'THIRD_PARTY_LICENSES.txt',
] as const;

const RuntimePath = Schema.String.check(
  Schema.makeFilter((path: string) => isSafeArtifactPath({ path }), {
    expected: 'a portable relative artifact path without parent traversal',
  }),
);

export const RuntimeFile = Schema.Struct({
  path: RuntimePath,
  sha256: ArtifactDigest.fields.sha256,
  bytes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export type RuntimeFile = typeof RuntimeFile.Type;

export const WorkerModule = Schema.Struct({
  ...RuntimeFile.fields,
  content_type: Schema.Literals([MediaType.JavaScriptModule, MediaType.WebAssembly]),
});

export const RuntimeBuild = Schema.Struct({
  version: Release,
  revision: GitCommit,
  node_version: Schema.String.check(Schema.isPattern(/^\d+\.\d+\.\d+$/)),
  worker_modules: Schema.Array(Schema.Struct({ path: RuntimePath, content_type: WorkerModule.fields.content_type })),
});

export type RuntimeBuild = typeof RuntimeBuild.Type;

export const RuntimeInventory = Schema.Struct({
  format_version: Schema.Literal(FORMAT_VERSION),
  version: Release,
  public_commit: GitCommit,
  files: Schema.Array(RuntimeFile),
});

export type RuntimeInventory = typeof RuntimeInventory.Type;

const OperationCommand = Schema.Struct({
  entrypoint: RuntimePath,
  arguments: Schema.Array(Schema.String),
  environment: Schema.Array(Schema.NonEmptyString),
});

export const RuntimeRelease = Schema.Struct({
  format_version: Schema.Literal(FORMAT_VERSION),
  version: Release,
  repository: Schema.Literal(RELEASE_REPOSITORY),
  public_commit: GitCommit,
  runtime: Schema.Struct({ archive: Schema.String.check(Schema.isPattern(ASSET_PATTERN)), ...ArtifactDigest.fields }),
  installation: Schema.Struct({ path: Schema.Literal('installation.json'), ...ArtifactDigest.fields }),
  provider_setup: Schema.Struct({
    name: Schema.String.check(Schema.isPattern(ASSET_PATTERN)),
    ...ArtifactDigest.fields,
  }),
  commands: Schema.Struct({
    node_version: RuntimeBuild.fields.node_version,
    migrate: OperationCommand,
    grant: OperationCommand,
    import: Schema.Struct({
      ...OperationCommand.fields,
      apply_environment: Schema.Array(Schema.NonEmptyString),
      apply_required_options: Schema.Array(Schema.NonEmptyString),
    }),
  }),
});

export type RuntimeRelease = typeof RuntimeRelease.Type;

type RuntimeCommandsInput = { readonly nodeVersion: string };

export function runtimeCommands({ nodeVersion }: RuntimeCommandsInput): RuntimeRelease['commands'] {
  return {
    node_version: nodeVersion,
    migrate: { entrypoint: MIGRATION_ENTRYPOINT, arguments: [], environment: ['MECHANE_MIGRATION_DATABASE_URL'] },
    grant: {
      entrypoint: GRANT_ENTRYPOINT,
      arguments: [],
      environment: ['MECHANE_MIGRATION_DATABASE_URL', 'MECHANE_RUNTIME_DATABASE_ROLE'],
    },
    import: {
      entrypoint: IMPORT_ENTRYPOINT,
      arguments: ['--dry-run', '--all'],
      environment: ['MECHANE_MIGRATION_DATABASE_URL'],
      apply_environment: ['MECHANE_ORIGIN', 'MECHANE_SANDBOX_SERVICE_KEY'],
      apply_required_options: ['--expect-digest', '--retirement-receipt', '--retirement-sha256'],
    },
  };
}

type ArtifactPathInput = { readonly path: string };

export function isSafeArtifactPath({ path }: ArtifactPathInput): boolean {
  return /^[A-Za-z0-9@._+/-]+$/.test(path) && path.split('/').every((part) => !FORBIDDEN_PATH_PARTS.has(part));
}
