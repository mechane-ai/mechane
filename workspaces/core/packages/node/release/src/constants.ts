import { fileURLToPath } from 'node:url';

/** The suffix `git describe --dirty` gives the revision of a working tree with uncommitted changes. */
export const DIRTY_SUFFIX = '-dirty';

/** The release program's name, which prefixes each diagnostic it writes. */
export const PROGRAM = 'release';

/** How the release program ends: its mode finished, or a step of it failed. */
export const ReleaseStatus = { Done: 0, Failed: 1 } as const;

export type ReleaseStatus = (typeof ReleaseStatus)[keyof typeof ReleaseStatus];

/** The release program builds CLI binaries and their manifest for publication. */
export const ReleaseMode = { Build: 'build' } as const;

export type ReleaseMode = (typeof ReleaseMode)[keyof typeof ReleaseMode];

/** The CLI's entry module, which Bun compiles into each binary. */
export const CLI_ENTRY = fileURLToPath(new URL('../../cli/src/main.ts', import.meta.url));

/** The release builder keeps each file at the path used by the CLI download API. */
export const RELEASE_BUILD_FOLDER = fileURLToPath(new URL('../../../../dist/release', import.meta.url));

/**
 * The parent variables each mode's children inherit: Bun and git are both found on `PATH`, and Bun keeps the runtimes
 * it downloads below the home folder.
 */
export const MODE_VARIABLES = { [ReleaseMode.Build]: ['PATH', 'HOME'] } as const;

/** Each build failure identifies the operation that failed. */
export const ReleaseStep = {
  ReadMode: 'read the mode',
  ReadRevision: 'read the source revision',
  EmptyBuildFolder: 'empty the release build folder',
  FindHostTarget: "find this machine's release target",
  CreateReleaseFolder: "create the release's folder",
  Compile: 'compile mechane',
  ReadBinary: 'read a compiled binary',
  WriteManifest: "write the release's manifest",
  ListFiles: 'list the release files',
} as const;

export type ReleaseStep = (typeof ReleaseStep)[keyof typeof ReleaseStep];
