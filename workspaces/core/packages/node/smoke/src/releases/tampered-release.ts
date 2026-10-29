import { ReleaseKey } from '@mechane/protocol';
import type { Stack } from '@mechane/stack';
import { FileStep, FileStepFailed } from '@mechane/testing';
import type { ScenarioFailure } from '@mechane/testing';
import { Effect } from 'effect';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ScenarioFolder } from './constants.ts';
import type { HostRelease } from './types.ts';

/** The largest value a byte holds, from which the tampered release subtracts its binary's last byte. */
const BYTE_MAX = 0xff;

/** The binary to read. */
type PathInput = { readonly path: string };

/** The stack, the scenario's folder, and the release to tamper with. */
type TamperedReleaseInput = { readonly stack: Stack; readonly folder: string; readonly release: HostRelease };

/**
 * Publishes a release with one byte of its binary changed, as a corrupted download or a tampered bucket would serve it.
 * Its size stays the same, so only the binary's SHA-256 tells it from the release's.
 */
export const tamperedRelease = Effect.fn('tamperedRelease')(function* ({
  stack,
  folder,
  release,
}: TamperedReleaseInput): Effect.fn.Return<void, ScenarioFailure> {
  const tampered = join(folder, ScenarioFolder.Tampered);
  const target = join(tampered, release.binary.path);
  const targetFolder = dirname(target);
  const latest = join(release.folder, ReleaseKey.Latest);
  const tamperedLatest = join(tampered, ReleaseKey.Latest);
  const bytes = yield* tamperedBytes({ path: join(release.folder, release.binary.path) });

  yield* Effect.tryPromise({
    try: () => mkdir(targetFolder, { recursive: true }),
    catch: (cause) => new FileStepFailed({ step: FileStep.Create, path: targetFolder, reason: String(cause) }),
  });
  yield* Effect.tryPromise({
    try: () => writeFile(target, bytes),
    catch: (cause) => new FileStepFailed({ step: FileStep.Write, path: target, reason: String(cause) }),
  });
  yield* Effect.tryPromise({
    try: () => copyFile(latest, tamperedLatest),
    catch: (cause) => new FileStepFailed({ step: FileStep.Write, path: tamperedLatest, reason: String(cause) }),
  });
  yield* stack.publish({ folder: tampered });
});

/** A binary's bytes with its last byte changed, so its size stays the same and only its SHA-256 differs. */
const tamperedBytes = Effect.fn('tamperedBytes')(function* ({
  path,
}: PathInput): Effect.fn.Return<Buffer, FileStepFailed> {
  const bytes = yield* Effect.tryPromise({
    try: () => readFile(path),
    catch: (cause) => new FileStepFailed({ step: FileStep.Read, path, reason: String(cause) }),
  });

  const last = bytes.length - 1;

  bytes.writeUInt8(BYTE_MAX - bytes.readUInt8(last), last);

  return bytes;
});
