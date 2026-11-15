import { artifactDigest } from '@mechane/program';
import { SANDBOX_TOOL_LIMITS } from '@mechane/sandbox-wire';
import type { SandboxTool, SandboxToolArchive } from '@mechane/sandbox-wire';
import { Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import { copyFile, lstat, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

const PRIVATE_DIRECTORY_MODE = 0o700;

class ToolCacheUnavailable extends Schema.TaggedError<ToolCacheUnavailable>()('ToolCacheUnavailable', {
  reason: Schema.String,
}) {}

type CacheFailure = ToolCacheUnavailable | Effect.Error<ReturnType<typeof artifactDigest>>;

type ToolCacheInput = {
  readonly cacheDirectory: string;
  readonly tool: SandboxTool;
  readonly archive: SandboxToolArchive;
  readonly archivePath: string;
};

/** The installation's archive checksum remains the authority even when guest commands change cached files. */
export const restoreGuestToolArchive = Effect.fn('restoreGuestToolArchive')(function* ({
  cacheDirectory,
  tool,
  archive,
  archivePath,
}: ToolCacheInput): Effect.fn.Return<boolean, CacheFailure> {
  const cached = join(cacheDirectory, `${tool.name}.tar.xz`);

  const details = yield* Effect.tryPromise({
    try: () => lstat(cached),
    catch: (cause) => new ToolCacheUnavailable({ reason: String(cause) }),
  });

  if (!details.isFile() || details.size > SANDBOX_TOOL_LIMITS.maxArchiveBytes) {
    return false;
  }

  yield* Effect.tryPromise({
    try: () => copyFile(cached, archivePath),
    catch: (cause) => new ToolCacheUnavailable({ reason: String(cause) }),
  });

  const digest = yield* artifactDigest({ path: archivePath });

  return digest.sha256 === archive.sha256;
});

/** Publish only an already verified archive; its next reader rechecks the installation pin. */
export const saveGuestToolArchive = Effect.fn('saveGuestToolArchive')(function* ({
  cacheDirectory,
  tool,
  archivePath,
}: ToolCacheInput): Effect.fn.Return<void, ToolCacheUnavailable, Scope.Scope> {
  yield* Effect.tryPromise({
    try: () => mkdir(cacheDirectory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE }),
    catch: (cause) => new ToolCacheUnavailable({ reason: String(cause) }),
  });

  const prefix = join(cacheDirectory, 'pending-');

  const opening = Effect.tryPromise({
    try: () => mkdtemp(prefix),
    catch: (cause) => new ToolCacheUnavailable({ reason: String(cause) }),
  });

  const folder = yield* Effect.acquireRelease(opening, removePendingCache);
  const staged = join(folder, 'archive.tar.xz');
  const cached = join(cacheDirectory, `${tool.name}.tar.xz`);

  yield* Effect.tryPromise({
    try: () => copyFile(archivePath, staged),
    catch: (cause) => new ToolCacheUnavailable({ reason: String(cause) }),
  });
  yield* Effect.tryPromise({
    try: () => rename(staged, cached),
    catch: (cause) => new ToolCacheUnavailable({ reason: String(cause) }),
  });
}, Effect.scoped);

const removePendingCache = Effect.fn('removePendingCache')(function* (folder: string): Effect.fn.Return<void> {
  const removal = Effect.tryPromise({
    try: () => rm(folder, { recursive: true, force: true }),
    catch: (cause) => new ToolCacheUnavailable({ reason: String(cause) }),
  });

  yield* removal.pipe(Effect.catchTags({ ToolCacheUnavailable: () => Effect.void }));
});
