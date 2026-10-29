import { Duration } from 'effect';
import { fileURLToPath } from 'node:url';

/** The suffix `git describe --dirty` gives the revision of a working tree with uncommitted changes. */
export const DIRTY_SUFFIX = '-dirty';

/**
 * The flag every Wrangler command takes, which names an empty env file. Wrangler otherwise loads `.env` and
 * `.env.local` of its working folder into its own environment. An ignored file there could turn off the redaction of
 * its debug log or send the operator's token to another API.
 */
export const EMPTY_DOTENV = ['--env-file', '/dev/null'] as const;

/** The release program's name, which prefixes each diagnostic it writes. */
export const PROGRAM = 'release';

/** How the release program ends: its mode finished, or a step of it failed. */
export const ReleaseStatus = { Done: 0, Failed: 1 } as const;

export type ReleaseStatus = (typeof ReleaseStatus)[keyof typeof ReleaseStatus];

/** What the release program does: build a release's files; the deploy program uploads them to production's bucket. */
export const ReleaseMode = { Build: 'build' } as const;

export type ReleaseMode = (typeof ReleaseMode)[keyof typeof ReleaseMode];

/** The CLI's entry module, which Bun compiles into each binary. */
export const CLI_ENTRY = fileURLToPath(new URL('../../cli/src/main.ts', import.meta.url));

/** The folder the release program builds into and uploads from, which holds each file at its bucket key. */
export const RELEASE_BUILD_FOLDER = fileURLToPath(new URL('../../../../dist/release', import.meta.url));

/** The Wrangler the app's package installs, which uploads to production's bucket. */
export const WRANGLER = fileURLToPath(new URL('../../../worker/app/node_modules/.bin/wrangler', import.meta.url));

/** What Wrangler writes to standard error when the bucket holds no object at the key it reads. */
export const MISSING_OBJECT_ERROR = 'The specified key does not exist';

/** How long Wrangler may take to read or upload one file of a release. */
export const UPLOAD_TIMEOUT = Duration.minutes(5);

/**
 * The parent variables each mode's children inherit: Bun and git are both found on `PATH`, and Bun keeps the runtimes
 * it downloads below the home folder.
 */
export const MODE_VARIABLES = { [ReleaseMode.Build]: ['PATH', 'HOME'] } as const;

/** The steps of building or uploading a release, each as the diagnostic of its failure words it. */
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
  ReadLatest: 'read the latest manifest',
  MatchRevision: 'match the built release to the working tree',
  CheckUnpublished: 'check that the release is unpublished',
  ReadBucketKey: "read a key of the releases' bucket",
  UploadFile: 'upload a release file',
} as const;

export type ReleaseStep = (typeof ReleaseStep)[keyof typeof ReleaseStep];
