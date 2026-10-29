import { Effect, Schema } from 'effect';
import { InputUnreadable } from '../errors.ts';
import { readText } from '../read-text.ts';
import { Baseline } from '../schemas.ts';
import type { ChecksFailure, Finding, SiteCounts } from '../types.ts';
import { mergedCounts } from './merged-counts.ts';
import { writeBaseline } from './write-baseline.ts';

/** The three versions of a baseline git passes its merge driver: the ancestor's, ours, which it overwrites, theirs. */
const MergePaths = Schema.Tuple([Schema.String, Schema.String, Schema.String]);

/** The command line's paths after the command. */
type PathsInput = { readonly paths: ReadonlyArray<string> };

type VersionInput = { readonly path: string };

/**
 * The merge command, which git runs as the `baseline-min` merge driver: it writes the merge of two versions of a
 * baseline over ours. Each file keeps the smaller count, a file one side dropped stays dropped, and a file only one
 * side added keeps its count.
 */
export const mergeBaselines = Effect.fn('mergeBaselines')(function* ({
  paths,
}: PathsInput): Effect.fn.Return<ReadonlyArray<Finding>, ChecksFailure> {
  const [ancestor, ours, theirs] = yield* Schema.decodeUnknownEffect(MergePaths)(paths).pipe(
    Effect.mapError(
      () =>
        new InputUnreadable({
          path: 'the merge command',
          reason: 'name the ancestor, ours and theirs, as git passes %O %A %B',
        }),
    ),
  );

  const counts = mergedCounts({
    ancestor: yield* versionCounts({ path: ancestor }),
    ours: yield* versionCounts({ path: ours }),
    theirs: yield* versionCounts({ path: theirs }),
  });

  yield* writeBaseline({ path: ours, counts });

  return [];
});

/** One version's counts; git passes an empty file as the ancestor of a baseline both sides added. */
const versionCounts = Effect.fn('versionCounts')(function* ({
  path,
}: VersionInput): Effect.fn.Return<SiteCounts, InputUnreadable> {
  const text = yield* readText({ path });

  if (text.trim() === '') {
    return {};
  }

  return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Baseline))(text).pipe(
    Effect.mapError((error) => new InputUnreadable({ path, reason: error.message })),
  );
});
