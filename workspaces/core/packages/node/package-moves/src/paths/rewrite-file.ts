import { FACTORY_FOLDER, FileUnwritable, InputUnreadable } from '@mechane/checks-kernel';
import type { PathMove } from '@mechane/checks-kernel';
import { Effect, Option } from 'effect';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { replacedPaths } from './replaced-paths.ts';

/** The heading of a contract's local adaptations, the only part of a library contract's body the pass rewrites. */
const ADAPTATIONS_HEADING = '## Local adaptations';

/** What closes a contract's front matter, whose paths the pass rewrites. */
const FRONT_MATTER_END = '\n---\n';

/** A file's text, the step's moves and their pattern, and whether a library pins the file's body. */
type RewrittenTextInput = {
  readonly text: string;
  readonly moves: ReadonlyArray<PathMove>;
  readonly pattern: RegExp;
  readonly isPinned: boolean;
};

/** A factory file, the step's moves and their pattern, and whether a library pins the file's body. */
type RewriteFileInput = {
  readonly path: string;
  readonly moves: ReadonlyArray<PathMove>;
  readonly pattern: RegExp;
  readonly isPinned: boolean;
};

/** Rewrites each moved path one factory file names, and writes the file only when its text changes. */
export const rewriteFile = Effect.fn('rewriteFile')(function* ({
  path,
  moves,
  pattern,
  isPinned,
}: RewriteFileInput): Effect.fn.Return<void, InputUnreadable | FileUnwritable> {
  const absolute = join(FACTORY_FOLDER, path);

  const text = yield* Effect.tryPromise({
    try: () => readFile(absolute, 'utf8'),
    catch: (cause) => new InputUnreadable({ path, reason: String(cause) }),
  });

  const rewritten = rewrittenText({ text, moves, pattern, isPinned });

  if (rewritten !== text) {
    yield* Effect.tryPromise({
      try: () => writeFile(absolute, rewritten),
      catch: (cause) => new FileUnwritable({ path, reason: String(cause) }),
    });
  }
});

/** A file's text with each moved path rewritten; a library contract keeps its body above its local adaptations. */
function rewrittenText({ text, moves, pattern, isPinned }: RewrittenTextInput): string {
  if (!isPinned) {
    return replacedPaths({ text, moves, pattern });
  }

  const bodyStart = text.indexOf(FRONT_MATTER_END) + FRONT_MATTER_END.length;

  const bodyEnd = Option.getOrElse(
    Option.liftPredicate(text.indexOf(ADAPTATIONS_HEADING), (start) => start >= 0),
    () => text.length,
  );

  const head = replacedPaths({ text: text.slice(0, bodyStart), moves, pattern });

  return `${head}${text.slice(bodyStart, bodyEnd)}${replacedPaths({ text: text.slice(bodyEnd), moves, pattern })}`;
}
