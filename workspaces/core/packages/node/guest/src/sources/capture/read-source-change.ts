import { SOURCE_PATCH_MAX_BYTES, SourceFileMode } from '@mechane/records';
import type { SourceChange, SourceId } from '@mechane/records';
import { Effect, Option } from 'effect';
import { readFile } from 'node:fs/promises';
import { SourceGuestFailed } from '../../errors.ts';
import { readSourceStatus } from './read-source-status.ts';
import { sourceChangePath } from './source-change-path.ts';

/** A requested relative path under the source directory whose ancestry was checked. */
type ReadSourceChangeInput = { readonly sourceId: SourceId; readonly folder: string; readonly path: string };
/** The owner's executable permission, read without treating other permission bits as executable. */
const OWNER_EXECUTABLE_MODE = { modulus: 0o200, minimum: 0o100 } as const;

/** Represents missing files as deletions and refuses links, special files, and oversized content. */
export const readSourceChange = Effect.fn('readSourceChange')(function* ({
  sourceId,
  folder,
  path,
}: ReadSourceChangeInput): Effect.fn.Return<SourceChange, SourceGuestFailed> {
  const filename = yield* sourceChangePath({ sourceId, folder, path });
  const status = yield* readSourceStatus({ sourceId, filename });

  if (Option.isNone(status)) {
    return { path, mode: Option.none(), base64: Option.none() };
  }

  const stat = status.value;

  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > SOURCE_PATCH_MAX_BYTES) {
    return yield* new SourceGuestFailed({ sourceId, reason: 'source changes require bounded regular files' });
  }

  const content = yield* Effect.tryPromise({
    try: () => readFile(filename),
    catch: () => new SourceGuestFailed({ sourceId, reason: 'source change could not be read' }),
  });

  const mode: SourceFileMode = (() => {
    if (stat.mode % OWNER_EXECUTABLE_MODE.modulus >= OWNER_EXECUTABLE_MODE.minimum) {
      return SourceFileMode.Executable;
    }

    return SourceFileMode.File;
  })();

  const encoded = content.toString('base64');

  return { path, mode: Option.some(mode), base64: Option.some(encoded) };
});
