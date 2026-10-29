import { AST_GREP, AST_GREP_CONFIGURATION, WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import type { InputUnreadable } from '@mechane/checks-kernel';
import { Effect } from 'effect';
import { join } from 'node:path';
import { finishedTool } from './finished-tool.ts';

/**
 * The ast-grep rules whose fixes apply, by id, the files and folders to scan, the globs of the files it leaves, and the
 * variables ast-grep inherits.
 */
type AstGrepFixesInput = {
  readonly rules: ReadonlyArray<string>;
  readonly targets: ReadonlyArray<string>;
  readonly excluded: ReadonlyArray<string>;
  readonly inherited: Readonly<Record<string, string>>;
};

/**
 * Applies the fixes of the named ast-grep rules over `targets` but the files an `excluded` glob matches, in one scan;
 * naming no rule scans nothing.
 */
export const astGrepFixes = Effect.fn('astGrepFixes')(function* ({
  rules,
  targets,
  excluded,
  inherited,
}: AstGrepFixesInput): Effect.fn.Return<void, InputUnreadable> {
  if (rules.length === 0) {
    return;
  }

  const configuration = join(WORKSPACE_FOLDER, AST_GREP_CONFIGURATION);
  const filter = `^(${rules.join('|')})$`;

  /** ast-grep's flag that leaves the files a glob matches. */
  const excludedFlag: (glob: string) => string = (glob) => `--globs=!${glob}`;

  yield* finishedTool({
    command: AST_GREP,
    args: ['scan', '-c', configuration, '-U', '--filter', filter, ...excluded.map(excludedFlag), ...targets],
    inherited,
  });
});
