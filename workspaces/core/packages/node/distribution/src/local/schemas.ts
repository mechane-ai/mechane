import { Schema } from 'effect';

const CelldAsset = Schema.Struct({ url: Schema.String, checksum: Schema.String });

/** The version and per-platform download pins required from the contributor toolchain lock. */
export const CelldRelease = Schema.Struct({
  'version': Schema.String,
  'platforms.macos-arm64': CelldAsset,
  'platforms.linux-arm64': CelldAsset,
  'platforms.linux-x64': CelldAsset,
});

export type CelldRelease = typeof CelldRelease.Type;
