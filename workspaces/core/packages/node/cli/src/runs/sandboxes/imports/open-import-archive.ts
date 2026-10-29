import { SandboxMaintenanceFailed } from '@mechane/cli-kernel';
import type { RunFailure } from '@mechane/cli-kernel';
import { SANDBOX_ARCHIVE_PART_BYTES } from '@mechane/protocol';
import { Array, Effect } from 'effect';
import type { Scope } from 'effect';
import { createHash } from 'node:crypto';
import type { Hash } from 'node:crypto';
import type { FileHandle } from 'node:fs/promises';
import { openImportFile } from './open-import-file.ts';
import { readImportPart } from './read-import-part.ts';
import type { ImportArchive } from './types.ts';

type OpenImportArchiveInput = { readonly file: string };

type HashImportPartInput = {
  readonly handle: FileHandle;
  readonly hash: Hash;
  readonly part: number;
  readonly bytes: number;
};

/** Hashes the entire source before the server accepts an import intent. */
export const openImportArchive = Effect.fn('openImportArchive')(function* ({
  file,
}: OpenImportArchiveInput): Effect.fn.Return<ImportArchive, RunFailure, Scope.Scope> {
  const handle = yield* openImportFile({ file });

  const stat = yield* Effect.tryPromise({
    try: () => handle.stat(),
    catch: () => new SandboxMaintenanceFailed({ reason: 'could not inspect import archive' }),
  });

  if (!stat.isFile() || stat.size === 0) {
    return yield* new SandboxMaintenanceFailed({ reason: 'import requires a nonempty archive file' });
  }

  const bytes = stat.size;
  const parts = Math.ceil(bytes / SANDBOX_ARCHIVE_PART_BYTES);
  const hash = createHash('sha256');

  const indexes = Array.range(0, parts - 1);

  for (const part of indexes) {
    yield* hashImportPart({ handle, hash, part, bytes });
  }

  return { handle, archive: { bytes, parts, sha256: hash.digest('hex') } };
});

const hashImportPart = Effect.fn('hashImportPart')(function* ({
  handle,
  hash,
  part,
  bytes,
}: HashImportPartInput): Effect.fn.Return<void, RunFailure> {
  const body = yield* readImportPart({ handle, part, bytes });

  hash.update(body);
});
