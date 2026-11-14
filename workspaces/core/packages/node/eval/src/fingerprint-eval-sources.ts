import { artifactDigest } from '@mechane/program';
import { Effect, Stream } from 'effect';
import { glob } from 'node:fs/promises';
import { isAbsolute, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EvalFileStep } from './constants.ts';
import { EvalFileFailed } from './errors.ts';
import { jsonDigest } from './json-digest.ts';

type FingerprintEvalSourcesInput = { readonly root: URL; readonly patterns: ReadonlyArray<string> };
type SourceFilesInput = { readonly folder: string; readonly pattern: string };
type SourceDigestInput = { readonly folder: string; readonly name: string };
type SourceDigest = { readonly name: string; readonly sha256: string };

/** Suites select result-affecting sources without making CLI or documentation edits invalidate saved work. */
export const fingerprintEvalSources = Effect.fn('fingerprintEvalSources')(function* ({
  root,
  patterns,
}: FingerprintEvalSourcesInput): Effect.fn.Return<string, EvalFileFailed> {
  const folder = yield* Effect.try({
    try: () => fileURLToPath(root),
    catch: (cause) => new EvalFileFailed({ step: EvalFileStep.Read, path: root.href, reason: String(cause) }),
  });

  if (patterns.length === 0) {
    return yield* new EvalFileFailed({
      step: EvalFileStep.Read,
      path: folder,
      reason: 'Select at least one source pattern',
    });
  }

  const groups = yield* Effect.forEach(patterns, (pattern) => sourceFiles({ folder, pattern }), { concurrency: 1 });
  const selected = groups.flat();
  const names = [...new Set(selected)].toSorted();
  const files = yield* Effect.forEach(names, (name) => sourceDigest({ folder, name }), { concurrency: 1 });

  return jsonDigest({ value: files });
});

const sourceFiles = Effect.fn('sourceFiles')(function* ({
  folder,
  pattern,
}: SourceFilesInput): Effect.fn.Return<ReadonlyArray<string>, EvalFileFailed> {
  const matching = glob(pattern, { cwd: folder, exclude: ['**/node_modules/**', '**/.git/**'], followSymlinks: false });

  const paths = Stream.fromAsyncIterable(matching, (cause) => {
    const reason = String(cause);

    return new EvalFileFailed({ step: EvalFileStep.Read, path: folder, reason });
  });

  const names = yield* Stream.runCollect(paths);

  if (names.length === 0) {
    return yield* new EvalFileFailed({
      step: EvalFileStep.Read,
      path: folder,
      reason: `Source pattern matched no files: ${pattern}`,
    });
  }

  return names;
});

const sourceDigest = Effect.fn('sourceDigest')(function* ({
  folder,
  name,
}: SourceDigestInput): Effect.fn.Return<SourceDigest, EvalFileFailed> {
  if (isAbsolute(name) || name.split(sep).includes('..')) {
    return yield* new EvalFileFailed({
      step: EvalFileStep.Read,
      path: name,
      reason: 'Source files must stay inside their declared root',
    });
  }

  const path = join(folder, name);

  const digest = yield* artifactDigest({ path }).pipe(
    Effect.mapError((error) => new EvalFileFailed({ step: EvalFileStep.Read, path, reason: error.reason })),
  );

  return { name: name.split(sep).join('/'), sha256: digest.sha256 };
});
