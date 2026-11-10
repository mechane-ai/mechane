import { ArtifactDigest, ReleaseDescriptor } from '@mechane/program';
import { Release, RELEASE_REPOSITORY } from '@mechane/protocol';
import { GitCommit, SHA256_PATTERN } from '@mechane/records';
import { WranglerMigrations } from '@mechane/wrangler';
import { Schema } from 'effect';
import {
  ASSET_PATTERN,
  ASSETS_CONFIGURATION_KEY,
  DIGEST_PATTERN,
  DURABLE_EXPORT,
  FORMAT_VERSION,
  RECEIPT_FORMAT_VERSION,
  WORKER_FILENAME,
} from './constants.ts';
import { RuntimeFile, WorkerModule } from './runtime-artifact.ts';

const Sha256 = Schema.String.check(Schema.isPattern(SHA256_PATTERN));
const ByteCount = Schema.Int.check(Schema.isGreaterThan(0));

/** The immutable bytes of a named release asset. */
export const Artifact = Schema.Struct({
  name: Schema.String.check(Schema.isPattern(ASSET_PATTERN)),
  ...ArtifactDigest.fields,
});

export type Artifact = typeof Artifact.Type;
const Binding = Schema.Struct({ name: Schema.String, class_name: Schema.String });

const DurableExport = Schema.Struct({
  type: Schema.Literal(DURABLE_EXPORT.type),
  storage: Schema.Literal(DURABLE_EXPORT.storage),
  state: Schema.Literal(DURABLE_EXPORT.state),
});

/** The versioned runtime, image, and storage metadata consumed by an installation module. */
export const InstallationManifest = Schema.Struct({
  format_version: Schema.Literal(FORMAT_VERSION),
  is_preview: Schema.Boolean,
  ...ReleaseDescriptor.fields,
  repository: Schema.Literal(RELEASE_REPOSITORY),
  module_files: Schema.Array(Artifact),
  runtime_files: Schema.Array(RuntimeFile),
  worker: Schema.Struct({
    path: Schema.Literal(WORKER_FILENAME),
    ...ArtifactDigest.fields,
    compatibility_date: Schema.String,
    compatibility_flags: Schema.Array(Schema.String),
    triggers: Schema.Struct({ crons: Schema.Array(Schema.String) }),
    container_classes: Schema.Array(Schema.String),
    bindings: Schema.Array(Binding),
    exports: Schema.Record(Schema.String, DurableExport),
    migrations: WranglerMigrations.fields.migrations,
    modules: Schema.Array(WorkerModule),
    assets: Schema.Struct({
      directory: Schema.Literal('console'),
      binding: Schema.Literal('ASSETS'),
      files: Schema.Array(Schema.Struct({ ...RuntimeFile.fields, content_type: Schema.NonEmptyString })),
      [ASSETS_CONFIGURATION_KEY]: Schema.Struct({
        html_handling: Schema.Literal('none'),
        not_found_handling: Schema.Literal('none'),
        run_worker_first: Schema.Literal(true),
      }),
    }),
  }),
  guest: Schema.Struct({
    url: Schema.String,
    sha256: Sha256,
    bytes: ByteCount,
    digest: Schema.String.check(Schema.isPattern(DIGEST_PATTERN)),
  }),
  defaults: Schema.Record(Schema.String, Schema.String),
});

export type InstallationManifest = typeof InstallationManifest.Type;

/** The public provenance and complete byte inventory of a distributable release. */
export const ArtifactReceipt = Schema.Struct({
  format_version: Schema.Literal(RECEIPT_FORMAT_VERSION),
  version: Release,
  repository: Schema.Literal(RELEASE_REPOSITORY),
  public_commit: GitCommit,
  assets: Schema.Array(Artifact),
});

export type ArtifactReceipt = typeof ArtifactReceipt.Type;
