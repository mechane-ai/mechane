import { FileUnwritable, movedPath, WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import type { PathMove } from '@mechane/checks-kernel';
import { Effect } from 'effect';
import { mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { RewrittenSource } from './packages.types.ts';

/** The step's moves, every file git tracks before it, and the TypeScript files the step rewrites. */
type RelocateFilesInput = {
  readonly moves: ReadonlyArray<PathMove>;
  readonly files: ReadonlyArray<string>;
  readonly sources: ReadonlyArray<RewrittenSource>;
};

/** Moves each file the step moves that it does not rewrite, such as a manifest or a document, as it stands. */
export const relocateFiles = Effect.fn('relocateFiles')(function* ({
  moves,
  files,
  sources,
}: RelocateFilesInput): Effect.fn.Return<void, FileUnwritable> {
  const rewritten: ReadonlySet<string> = new Set(sources.map(({ from }) => from));

  /** Whether the step leaves the file's text as it stands. */
  const isKept: (path: string) => boolean = (path) => !rewritten.has(path);

  /** The file's move, from its path to where the step takes it. */
  const fileMove: (from: string) => PathMove = (from) => ({ from, to: movedPath({ moves, path: from }) });

  const relocated = files
    .filter(isKept)
    .map(fileMove)
    .filter(({ from, to }) => from !== to);

  yield* Effect.forEach(relocated, relocateFile, { concurrency: 1, discard: true });
});

/** Moves one file as it stands, making its destination's folder first. */
const relocateFile = Effect.fn('relocateFile')(function* ({
  from,
  to,
}: PathMove): Effect.fn.Return<void, FileUnwritable> {
  const target = join(WORKSPACE_FOLDER, to);
  const folder = dirname(target);
  const source = join(WORKSPACE_FOLDER, from);

  yield* Effect.tryPromise({
    try: () => mkdir(folder, { recursive: true }),
    catch: (cause) => new FileUnwritable({ path: to, reason: String(cause) }),
  });
  yield* Effect.tryPromise({
    try: () => rename(source, target),
    catch: (cause) => new FileUnwritable({ path: to, reason: String(cause) }),
  });
});
