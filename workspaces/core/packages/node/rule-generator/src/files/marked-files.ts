import { Array, Effect } from 'effect';
import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { GenerateStep, WORKSPACE_FOLDER } from '../constants.ts';
import { GenerateFailed } from '../errors.ts';

/** The folder of every generated lint file, where a file that carries the generated mark is the registry's. */
const LINT_FOLDER = 'lint';

/** The words that open every generated file's first comment, whatever the comment's syntax. */
const GENERATED_MARK = 'Generated from @mechane/rules';

/** A file below the lint folder, by its path relative to the workspace. */
type LintTextInput = { readonly path: string };

/** A lint file's path, and its text. */
type LintFile = readonly [string, string];

/** Every file below the lint folder whose first line carries the generated mark, relative to the workspace, sorted. */
export const markedFiles = Effect.fn('markedFiles')(function* (): Effect.fn.Return<
  ReadonlyArray<string>,
  GenerateFailed
> {
  const folder = join(WORKSPACE_FOLDER, LINT_FOLDER);

  const entries = yield* Effect.tryPromise({
    try: () => readdir(folder, { recursive: true, withFileTypes: true }),
    catch: (cause) => new GenerateFailed({ step: GenerateStep.Read, path: LINT_FOLDER, reason: String(cause) }),
  });

  const workspacePath: (entry: Dirent) => string = (entry) =>
    relative(WORKSPACE_FOLDER, join(entry.parentPath, entry.name));

  const paths = entries.filter((entry) => entry.isFile()).map(workspacePath);
  const texts = yield* Effect.forEach(paths, (path) => lintText({ path }), { concurrency: 'unbounded' });

  const isMarked: (file: LintFile) => boolean = ([, text]) =>
    text.slice(0, text.indexOf('\n')).includes(GENERATED_MARK);

  return Array.zip(paths, texts)
    .filter(isMarked)
    .map(([path]) => path)
    .toSorted();
});

/** A lint file's text; a read that fails fails the listing of the lint folder. */
const lintText = Effect.fn('lintText')(function* ({ path }: LintTextInput): Effect.fn.Return<string, GenerateFailed> {
  const absolute = join(WORKSPACE_FOLDER, path);

  return yield* Effect.tryPromise({
    try: () => readFile(absolute, 'utf8'),
    catch: (cause) => new GenerateFailed({ step: GenerateStep.Read, path: LINT_FOLDER, reason: String(cause) }),
  });
});
