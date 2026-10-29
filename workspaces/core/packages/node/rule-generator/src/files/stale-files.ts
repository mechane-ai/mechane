import type { GeneratedFile } from '@mechane/rules';
import { Array, Effect } from 'effect';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { WORKSPACE_FOLDER } from '../constants.ts';
import type { GenerateFailed } from '../errors.ts';
import { markedFiles } from './marked-files.ts';
import { readInput } from './read-input.ts';

type StaleFilesInput = { readonly files: ReadonlyArray<GeneratedFile> };

/** A generated file, by its path relative to the workspace. */
type CommittedTextInput = { readonly path: string };

/**
 * What differs from the registry: each generated file whose committed text differs, a missing one included. A stray
 * carries the generated mark though the registry no longer generates it.
 */
type StaleFiles = { readonly changed: ReadonlyArray<string>; readonly strays: ReadonlyArray<string> };

/** A generated file, and the text its path holds now. */
type Comparison = readonly [GeneratedFile, string];

/**
 * Each generated file whose committed text differs from the registry's, a missing file included. Each lint file that
 * carries the generated mark but that the registry no longer generates is a stray (AS-03).
 */
export const staleFiles = Effect.fn('staleFiles')(function* ({
  files,
}: StaleFilesInput): Effect.fn.Return<StaleFiles, GenerateFailed> {
  const committed = yield* Effect.forEach(files, ({ path }) => committedText({ path }), { concurrency: 1 });
  const generated: ReadonlySet<string> = new Set(files.map(({ path }) => path));
  const marked = yield* markedFiles();
  const isStray: (path: string) => boolean = (path) => !generated.has(path);
  const changedPath: (comparison: Comparison) => string = ([{ path }]) => path;

  return {
    changed: Array.zip(files, committed)
      .filter(([{ text }, current]) => current !== text)
      .map(changedPath),
    strays: marked.filter(isStray),
  };
});

/** A generated file's committed text, empty when it does not exist yet. */
const committedText = Effect.fn('committedText')(function* ({
  path,
}: CommittedTextInput): Effect.fn.Return<string, GenerateFailed> {
  if (!existsSync(join(WORKSPACE_FOLDER, path))) {
    return '';
  }

  return yield* readInput({ path });
});
