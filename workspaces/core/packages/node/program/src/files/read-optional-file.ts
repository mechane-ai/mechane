import { Effect, Option, Schema } from 'effect';
import { readFile } from 'node:fs/promises';

/** The code Node gives a read of a file that does not exist. */
const MISSING_FILE_CODE = 'ENOENT';

/** A file that exists could not be read. */
class FileReadFailed extends Schema.TaggedError<FileReadFailed>()('FileReadFailed', {
  path: Schema.String,
  reason: Schema.String,
}) {}

/** A file read attempt failed before missing files are separated from unexpected I/O errors. */
class ReadAttemptFailed extends Schema.TaggedError<ReadAttemptFailed>()('ReadAttemptFailed', {
  path: Schema.String,
  failure: Schema.Unknown,
}) {}

/** The failure with which Node reads a file that does not exist. */
const MissingFile = Schema.Struct({ code: Schema.Literal(MISSING_FILE_CODE) });

const isMissingFile = Schema.is(MissingFile);

type ReadOptionalFileInput = { readonly path: string };

/** The text of the file at `path` as UTF-8, none when the file does not exist. */
export const readOptionalFile = Effect.fn('readOptionalFile')(function* ({
  path,
}: ReadOptionalFileInput): Effect.fn.Return<Option.Option<string>, FileReadFailed> {
  return yield* readFileAttempt({ path }).pipe(
    Effect.catchTags({
      ReadAttemptFailed: (attempt) => {
        if (isMissingFile(attempt.failure)) {
          return Effect.succeedNone;
        }

        const reason = String(attempt.failure);
        const error = new FileReadFailed({ path: attempt.path, reason });

        return Effect.fail(error);
      },
    }),
  );
});

/** Reads a file at `path` as UTF-8, retaining the raw failure for missing-file (`ENOENT`) classification. */
const readFileAttempt = Effect.fn('readFileAttempt')(function* ({
  path,
}: ReadOptionalFileInput): Effect.fn.Return<Option.Option<string>, ReadAttemptFailed> {
  const text = yield* Effect.tryPromise({
    try: () => readFile(path, 'utf8'),
    catch: (failure) => new ReadAttemptFailed({ path, failure }),
  });

  return Option.some(text);
});
