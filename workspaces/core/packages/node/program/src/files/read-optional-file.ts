import { Effect, Option, Schema } from 'effect';
import { readFile } from 'node:fs/promises';

/** The code Node gives a read of a file that does not exist. */
const MISSING_FILE_CODE = 'ENOENT';

/** A file that exists could not be read. */
class FileReadFailed extends Schema.TaggedError<FileReadFailed>()('FileReadFailed', {
  path: Schema.String,
  reason: Schema.String,
}) {}

/** The file a read names does not exist, which `readOptionalFile` answers as none. */
class FileMissing extends Schema.TaggedError<FileMissing>()('FileMissing', {}) {}

/** The failure with which Node reads a file that does not exist. */
const MissingFile = Schema.Struct({ code: Schema.Literal(MISSING_FILE_CODE) });

type MissingFile = typeof MissingFile.Type;

type ReadOptionalFileInput = { readonly path: string };

type ReadPresentFileInput = { readonly path: string };

/** The text of the file at `path` as UTF-8, none when the file does not exist. */
export const readOptionalFile = Effect.fn('readOptionalFile')(function* ({
  path,
}: ReadOptionalFileInput): Effect.fn.Return<Option.Option<string>, FileReadFailed> {
  return yield* readPresentFile({ path }).pipe(Effect.catchTags({ FileMissing: () => Effect.succeedNone }));
});

/** The text of the file at `path` as UTF-8, which fails apart as missing when the file does not exist. */
const readPresentFile = Effect.fn('readPresentFile')(function* ({
  path,
}: ReadPresentFileInput): Effect.fn.Return<Option.Option<string>, FileMissing | FileReadFailed> {
  const text = yield* Effect.tryPromise({
    try: () => readFile(path, 'utf8'),
    catch: (cause) => {
      if (Schema.is(MissingFile)(cause)) {
        return new FileMissing();
      }

      return new FileReadFailed({ path, reason: String(cause) });
    },
  });

  return Option.some(text);
});
