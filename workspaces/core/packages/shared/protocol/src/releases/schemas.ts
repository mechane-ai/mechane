import { SHA256_PATTERN } from '@mechane/records';
import { Record, Schema } from 'effect';
import { Revision } from '../schemas.ts';
import { CliTarget, RELEASE_PATTERN, ReleaseKey } from './constants.ts';

/** A release of Mechane, which the Worker reports and each CLI binary is stamped with. */
export const Release = Schema.String.check(Schema.isPattern(RELEASE_PATTERN));

export type Release = typeof Release.Type;

/** A target as a key and a stamp write it; a template literal takes literals, not an enum. */
const Target = Schema.Literals(Record.values(CliTarget));

/** The key of the latest release's manifest, which each release replaces. */
export const LatestKey = Schema.Literal(ReleaseKey.Latest);

export type LatestKey = typeof LatestKey.Type;

/** The key of a release's binary for one target, which never changes once published. */
export const BinaryKey = Schema.TemplateLiteral([ReleaseKey.Folder, Release, ReleaseKey.Binary, Target]);

export type BinaryKey = typeof BinaryKey.Type;

/** The key of a release's own manifest, which never changes once published. */
export const ManifestKey = Schema.TemplateLiteral([ReleaseKey.Folder, Release, ReleaseKey.Manifest]);

export type ManifestKey = typeof ManifestKey.Type;

/** One binary of a release: its key, below the deployment's origin, and the digest and size its bytes must have. */
const ReleaseBinary = Schema.Struct({
  path: BinaryKey,
  sha256: Schema.String.check(Schema.isPattern(SHA256_PATTERN)),
  bytes: Schema.Int.check(Schema.isGreaterThan(0)),
});

/**
 * A release's manifest, which `cli/latest.json` repeats for the latest one: the release, the clean revision of its
 * source, and its binaries. They are keyed by target as text, so a later release may add a target an older reader
 * skips. As install.sh reads it as text, no value holds a comma, brace or quote, no nested field is named `release`,
 * and a binary's `path` and `sha256` precede any object.
 */
export const ReleaseManifest = Schema.Struct({
  release: Release,
  revision: Revision,
  binaries: Schema.Record(Schema.String, ReleaseBinary),
});

export type ReleaseManifest = typeof ReleaseManifest.Type;

/** The release stamp a release compiles into each CLI binary: its release and target. A run from source has none. */
export const ReleaseStamp = Schema.Struct({ release: Release, target: Target });

export type ReleaseStamp = typeof ReleaseStamp.Type;
