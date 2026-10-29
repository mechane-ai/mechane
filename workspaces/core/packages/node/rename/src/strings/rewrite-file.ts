import { Effect } from 'effect';
import { basename } from 'node:path';
import type { FileFailed } from '../errors.ts';
import { readText } from '../files/read-text.ts';
import { writeText } from '../files/write-text.ts';
import type { StringRename } from '../types.ts';
import { isApplied } from './is-applied.ts';
import { rewriteText } from './rewrite-text.ts';

/** A contract's file, whose text above its local adaptations a library pins, so only the adaptations change. */
const CONTRACT_FILE = 'CONTRACT.md';

/** The heading of a contract's local adaptations, the only part of a contract the string pass rewrites. */
const ADAPTATIONS_HEADING = '## Local adaptations';

/** A map's wire strings, and one file of the factory. */
type RewriteFileInput = { readonly renames: ReadonlyArray<StringRename>; readonly path: string };

/** A file of the factory, and its text. */
type KeptLengthInput = { readonly path: string; readonly text: string };

/** Rewrites the wire strings that apply to one file, and writes it only when its text changes. */
export const rewriteFile = Effect.fn('rewriteFile')(function* ({
  renames,
  path,
}: RewriteFileInput): Effect.fn.Return<void, FileFailed> {
  const text = yield* readText({ path });
  const kept = keptLength({ path, text });
  const applying = renames.filter((rename) => isApplied({ rename, path }));
  const rewritten = `${text.slice(0, kept)}${rewriteText({ renames: applying, text: text.slice(kept) })}`;

  if (rewritten !== text) {
    yield* writeText({ path, text: rewritten });
  }
});

/**
 * How much of the file stays as written: a library contract's text above its local adaptations. A local contract, which
 * has no such heading, and any other file keep none.
 */
function keptLength({ path, text }: KeptLengthInput): number {
  if (basename(path) !== CONTRACT_FILE) {
    return 0;
  }

  return Math.max(text.indexOf(ADAPTATIONS_HEADING), 0);
}
