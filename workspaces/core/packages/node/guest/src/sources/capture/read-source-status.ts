import type { SourceId } from '@mechane/records';
import { Effect, Option, Schema } from 'effect';
import type { Stats } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { SourceGuestFailed } from '../../errors.ts';

/** The host filesystem's distinction between a deletion and an unreadable path. */
const FileErrorCode = { Missing: 'ENOENT' } as const;
const MissingFile = Schema.Struct({ code: Schema.Literal(FileErrorCode.Missing) });

/** A foreign stat failure, kept only until its absence code is classified. */
class SourceFileStatFailed extends Schema.TaggedError<SourceFileStatFailed>()('SourceFileStatFailed', {
  filesystemError: Schema.Unknown,
}) {}

type ReadSourceStatusInput = { readonly sourceId: SourceId; readonly filename: string };

type SourceStatFailures = {
  /** Absent when the requested leaf no longer exists, which records a deletion. */
  readonly SourceFileStatFailed: (
    failure: SourceFileStatFailed,
  ) => Effect.Effect<Option.Option<Stats>, SourceGuestFailed>;
};

/** A missing leaf means deletion; every other host failure becomes a sanitized guest failure. */
export const readSourceStatus = Effect.fn('readSourceStatus')(function* ({
  sourceId,
  filename,
}: ReadSourceStatusInput): Effect.fn.Return<Option.Option<Stats>, SourceGuestFailed> {
  const missingStatus: SourceStatFailures['SourceFileStatFailed'] = (failure) => {
    if (Schema.is(MissingFile)(failure.filesystemError)) {
      const missing = Option.none<Stats>();

      return Effect.succeed(missing);
    }

    const unavailable = new SourceGuestFailed({ sourceId, reason: 'source change is unavailable' });

    return Effect.fail(unavailable);
  };

  const failures: SourceStatFailures = { SourceFileStatFailed: missingStatus };

  return yield* readPresentStatus({ filename }).pipe(Effect.catchTags(failures));
});

/** Preserves the filesystem error only long enough to distinguish a missing leaf from a refused read. */
const readPresentStatus = Effect.fn('readPresentStatus')(function* ({
  filename,
}: Pick<ReadSourceStatusInput, 'filename'>): Effect.fn.Return<Option.Option<Stats>, SourceFileStatFailed> {
  const status = yield* Effect.tryPromise({
    try: () => lstat(filename),
    catch: (filesystemError) => new SourceFileStatFailed({ filesystemError }),
  });

  return Option.some(status);
});
