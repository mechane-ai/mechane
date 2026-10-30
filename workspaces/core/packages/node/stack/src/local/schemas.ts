import { Release } from '@mechane/protocol';
import { GitCommit, SHA256_PATTERN } from '@mechane/records';
import { BaseConfiguration } from '@mechane/wrangler';
import { Schema } from 'effect';
import { LocalTarget } from './constants.ts';

const LOCAL_PACKAGE_FORMAT_VERSION = 1;

const PackageFile = Schema.Struct({
  sha256: Schema.String.check(Schema.isPattern(SHA256_PATTERN)),
  bytes: Schema.Int.check(Schema.isGreaterThan(0)),
});

/** The launcher verifies each runtime input before handing the release to celld. */
export const LocalPackage = Schema.Struct({
  format_version: Schema.Literal(LOCAL_PACKAGE_FORMAT_VERSION),
  version: Release,
  public_commit: GitCommit,
  target: Schema.Enum(LocalTarget),
  configuration: BaseConfiguration,
  files: Schema.Struct({
    'worker.js': PackageFile,
    'guest.oci.tar': PackageFile,
    'celld': PackageFile,
    'mechane': PackageFile,
  }),
});

export type LocalPackage = typeof LocalPackage.Type;
