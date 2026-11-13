import { Effect, Schema } from 'effect';
import { lstat, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUTPUT_FILES = 64;
const OWNER_DIRECTORY_MODE = 0o700;
const OWNER_FILE_MODE = 0o600;

class OutputFileUnavailable extends Schema.TaggedError<OutputFileUnavailable>()('OutputFileUnavailable', {
  reason: Schema.String,
}) {}

export const OutputFileStatus = { Saved: 'saved', Unavailable: 'unavailable' } as const;
type OutputFileState = (typeof OutputFileStatus)[keyof typeof OutputFileStatus];

const recoverOutput: (effect: Effect.Effect<OutputFileState, OutputFileUnavailable>) => Effect.Effect<OutputFileState> =
  Effect.catchTags({ OutputFileUnavailable: () => Effect.succeed(OutputFileStatus.Unavailable) });

type SaveCommandOutputInput = { readonly directory: string; readonly path: string; readonly bytes: Buffer };

/** Only a completed, flushed write may be named in the receipt; failed captures never replay the command. */
export const saveCommandOutput = Effect.fn('saveCommandOutput')(function* ({
  directory,
  path,
  bytes,
}: SaveCommandOutputInput): Effect.fn.Return<OutputFileState, OutputFileUnavailable> {
  yield* Effect.tryPromise({
    try: () => mkdir(directory, { recursive: true, mode: OWNER_DIRECTORY_MODE }),
    catch: () => new OutputFileUnavailable({ reason: 'Cannot create the output directory' }),
  });

  const folder = yield* Effect.tryPromise({
    try: () => lstat(directory),
    catch: () => new OutputFileUnavailable({ reason: 'Cannot inspect the output directory' }),
  });

  if (!folder.isDirectory() || folder.isSymbolicLink()) {
    return yield* new OutputFileUnavailable({ reason: 'The output directory must be a regular directory' });
  }

  yield* Effect.tryPromise({
    try: () => writeFile(path, bytes, { mode: OWNER_FILE_MODE, flag: 'wx', flush: true }),
    catch: () => new OutputFileUnavailable({ reason: 'Cannot save the output file' }),
  });

  const entries = yield* Effect.tryPromise({
    try: () => readdir(directory, { withFileTypes: true }),
    catch: () => new OutputFileUnavailable({ reason: 'Cannot list retained output files' }),
  });

  const logs = entries.filter((entry) => entry.isFile() && /^[0-9]{16}-[a-f0-9]{64}\.log$/u.test(entry.name));
  const oldest = logs.toSorted((left, right) => right.name.localeCompare(left.name)).slice(OUTPUT_FILES);

  yield* Effect.forEach(
    oldest,
    (entry) => {
      const expired = join(directory, entry.name);

      return Effect.tryPromise({
        try: () => rm(expired, { force: true }),
        catch: () => new OutputFileUnavailable({ reason: 'Cannot reclaim expired output files' }),
      });
    },
    { concurrency: 1 },
  );

  return OutputFileStatus.Saved;
}, recoverOutput);
