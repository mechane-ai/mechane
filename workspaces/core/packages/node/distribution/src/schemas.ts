import { Lock } from '@mechane/program';
import { Release } from '@mechane/protocol';
import { GitCommit, SHA256_PATTERN } from '@mechane/records';
import { WranglerMigrations } from '@mechane/wrangler';
import { Schema } from 'effect';
import {
  ASSET_PATTERN,
  DIGEST_PATTERN,
  DURABLE_EXPORT,
  FORMAT_VERSION,
  PUBLIC_REPOSITORY,
  WORKER_FILENAME,
} from './constants.ts';

const Sha256 = Schema.String.check(Schema.isPattern(SHA256_PATTERN));
const ByteCount = Schema.Int.check(Schema.isGreaterThan(0));

/** The immutable bytes of a named release asset. */
export const Artifact = Schema.Struct({
  name: Schema.String.check(Schema.isPattern(ASSET_PATTERN)),
  sha256: Sha256,
  bytes: ByteCount,
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
  version: Release,
  repository: Schema.Literal(PUBLIC_REPOSITORY),
  public_commit: GitCommit,
  module_files: Schema.Array(Artifact),
  worker: Schema.Struct({
    path: Schema.Literal(WORKER_FILENAME),
    sha256: Sha256,
    bytes: ByteCount,
    compatibility_date: Schema.String,
    compatibility_flags: Schema.Array(Schema.String),
    bindings: Schema.Array(Binding),
    exports: Schema.Record(Schema.String, DurableExport),
    migrations: WranglerMigrations.fields.migrations,
  }),
  guest: Schema.Struct({
    url: Schema.String,
    sha256: Sha256,
    bytes: ByteCount,
    digest: Schema.String.check(Schema.isPattern(DIGEST_PATTERN)),
  }),
  defaults: Schema.Record(Schema.String, Schema.String),
  formats: Schema.Struct({ wire: Lock, migrations: Lock }),
});

export type InstallationManifest = typeof InstallationManifest.Type;

/** The public provenance and complete byte inventory of a distributable release. */
export const ArtifactReceipt = Schema.Struct({
  format_version: Schema.Literal(FORMAT_VERSION),
  version: Release,
  repository: Schema.Literal(PUBLIC_REPOSITORY),
  public_commit: GitCommit,
  assets: Schema.Array(Artifact),
});

export type ArtifactReceipt = typeof ArtifactReceipt.Type;
