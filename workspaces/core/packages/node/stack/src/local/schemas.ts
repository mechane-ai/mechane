import { ArtifactDigest, ReleaseDescriptor } from '@mechane/program';
import { BaseConfiguration } from '@mechane/wrangler';
import { Schema } from 'effect';
import { LOCAL_PACKAGE_FORMAT_VERSION, LocalTarget } from './constants.ts';

/** The launcher verifies each runtime input before handing the release to celld. */
export const LocalPackage = Schema.Struct({
  format_version: Schema.Literal(LOCAL_PACKAGE_FORMAT_VERSION),
  ...ReleaseDescriptor.fields,
  target: Schema.Enum(LocalTarget),
  configuration: BaseConfiguration,
  files: Schema.Struct({ 'guest.oci.tar': ArtifactDigest, 'celld': ArtifactDigest, 'mechane': ArtifactDigest }),
});

export type LocalPackage = typeof LocalPackage.Type;
