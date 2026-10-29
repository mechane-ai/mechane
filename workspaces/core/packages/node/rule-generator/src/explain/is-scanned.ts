import { Option } from 'effect';
import { matchesGlob } from 'node:path';
import type { RuleFile } from '../types.ts';

/** A path relative to the workspace, and an ast-grep rule file's globs of the files it scans and of those it skips. */
type IsScannedInput = {
  readonly path: string;
  readonly files: RuleFile['files'];
  readonly ignores: RuleFile['ignores'];
};

/** Whether an ast-grep rule scans the path: one of its file globs matches it, and none of its ignored globs. */
export function isScanned({ path, files, ignores }: IsScannedInput): boolean {
  const matchesAny: (globs: ReadonlyArray<string>) => boolean = (globs) =>
    globs.some((glob) => matchesGlob(path, glob));

  const isIgnored = Option.exists(ignores, matchesAny);

  return files.some((glob) => matchesGlob(path, glob)) && !isIgnored;
}
