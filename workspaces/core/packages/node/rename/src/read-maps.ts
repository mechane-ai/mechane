import { Effect, Schema } from 'effect';
import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileStep } from './constants.ts';
import { FileFailed } from './errors.ts';
import { readText } from './files/read-text.ts';
import { RenameMap } from './schemas.ts';
import type { PathInput } from './types.ts';

/**
 * The folder of the committed maps, which replay in the order of their names; each applies its three passes in order:
 * identifiers, then files, then strings.
 */
const MAPS_FOLDER = fileURLToPath(new URL('maps/', import.meta.url));

/** The extension of a committed map. */
const MAP_EXTENSION = '.json';

/** Reads and decodes every committed map, in the order of their names, which is the order they apply in. */
export const readMaps = Effect.fn('readMaps')(function* (): Effect.fn.Return<ReadonlyArray<RenameMap>, FileFailed> {
  const names = yield* Effect.tryPromise({
    try: () => readdir(MAPS_FOLDER),
    catch: (cause) => new FileFailed({ step: FileStep.List, path: MAPS_FOLDER, reason: String(cause) }),
  });

  /** Whether the file is a map. */
  const isMap: (name: string) => boolean = (name) => extname(name) === MAP_EXTENSION;
  const paths = names.filter(isMap).map((name) => join(MAPS_FOLDER, name));

  return yield* Effect.forEach(paths.toSorted(), (path) => readMap({ path }), { concurrency: 1 });
});

/** Reads and decodes one committed map. */
const readMap = Effect.fn('readMap')(function* ({ path }: PathInput): Effect.fn.Return<RenameMap, FileFailed> {
  const text = yield* readText({ path });

  return yield* Schema.decodeUnknownEffect(RenameMap)(text).pipe(
    Effect.mapError((failure) => new FileFailed({ step: FileStep.Decode, path, reason: failure.message })),
  );
});
