import { Effect } from 'effect';
import { globSync } from 'node:fs';
import { basename } from 'node:path';
import { GenerateStep, WORKSPACE_FOLDER } from '../constants.ts';
import { GenerateFailed } from '../errors.ts';

/** The folders the listing of the workspace skips, by name: installed packages, builds, Git's and Wrangler's state. */
const SKIPPED_FOLDERS: ReadonlySet<string> = new Set(['node_modules', 'dist', '.git', '.wrangler']);

/** The patterns of the listing: every path, and every dotfile, which `**` alone leaves out. */
const WORKSPACE_PATTERNS = ['**/*', '**/.*'] as const;

/**
 * Every file and folder of the workspace, dotfiles included, relative to it, without installed packages, builds, Git's
 * and Wrangler's state.
 */
export const workspaceFiles = Effect.fn('workspaceFiles')(function* (): Effect.fn.Return<
  ReadonlyArray<string>,
  GenerateFailed
> {
  const isSkipped: (path: string) => boolean = (path) => SKIPPED_FOLDERS.has(basename(path));

  return yield* Effect.try({
    try: () => globSync(WORKSPACE_PATTERNS, { cwd: WORKSPACE_FOLDER, exclude: isSkipped }),
    catch: (cause) => new GenerateFailed({ step: GenerateStep.Read, path: WORKSPACE_FOLDER, reason: String(cause) }),
  });
});
