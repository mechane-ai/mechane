import {
  contractLock,
  FACTORY_FOLDER,
  folderPrefixPath,
  gitLines,
  lockedAssets,
  MOVE_MAP,
  movedPath,
} from '@mechane/checks-kernel';
import type { FileUnwritable, InputUnreadable, PathMove } from '@mechane/checks-kernel';
import { Effect } from 'effect';
import { basename, extname, join } from 'node:path';
import { WORKSPACE_PREFIX } from './constants.ts';
import { pathPattern } from './path-pattern.ts';
import { rewriteFile } from './rewrite-file.ts';

/** The extensions of the factory's files that name paths: code, configuration and documents. */
const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  '.ts',
  '.json',
  '.jsonc',
  '.md',
  '.yml',
  '.yaml',
  '.toml',
  '.sh',
  '.cjs',
]);

/** The factory's files without an extension that name paths. */
const PLAIN_FILES: ReadonlySet<string> = new Set(['CODEOWNERS']);

/** The factory's folder of dated notes, which keep the paths of their day. */
const NOTES_FOLDER = '.context';

/** The workspace's files and folders the pass leaves, by their paths before the step: the maps and the lockfile. */
const KEPT_PATHS = [MOVE_MAP, 'packages/node/rename/src/maps', 'pnpm-lock.yaml'] as const;

/** A step's moves, and the variables git inherits. */
type RewritePathsInput = {
  readonly moves: ReadonlyArray<PathMove>;
  readonly inherited: Readonly<Record<string, string>>;
};

/**
 * A factory file, and the paths the pass leaves: the dated notes, the maps, the lockfile and each installed asset, and
 * the deleted files.
 */
type IsRewrittenInput = {
  readonly path: string;
  readonly kept: ReadonlyArray<string>;
  readonly deleted: ReadonlySet<string>;
};

/**
 * Rewrites each path a step moves wherever a factory text file names it, relative to the workspace or the factory. The
 * dated notes, the maps, the lockfile and each asset file the contract lock lists keep their paths. A library contract
 * changes only in its front matter and its local adaptations, since the library pins the rest.
 */
export const rewritePaths = Effect.fn('rewritePaths')(function* ({
  moves,
  inherited,
}: RewritePathsInput): Effect.fn.Return<void, InputUnreadable | FileUnwritable> {
  const listed = yield* gitLines({
    args: ['-C', FACTORY_FOLDER, 'ls-files', '--cached', '--others', '--exclude-standard'],
    inherited,
  });

  const deleted = new Set(yield* gitLines({ args: ['-C', FACTORY_FOLDER, 'ls-files', '--deleted'], inherited }));
  const lock = yield* contractLock();

  /** The factory path of a kept workspace path, where the step leaves it. */
  const keptPath: (path: string) => string = (path) => join(WORKSPACE_PREFIX, movedPath({ moves, path }));
  const assets = lockedAssets({ lock });
  const kept = [NOTES_FOLDER, ...KEPT_PATHS.map(keptPath), ...assets];
  const files = listed.filter((path) => isRewritten({ path, kept, deleted }));
  const pattern = pathPattern({ moves });

  /** Rewrites one factory file's paths. */
  const rewritten: (path: string) => Effect.Effect<void, InputUnreadable | FileUnwritable> = (path) => {
    const isPinned = Object.hasOwn(lock.contracts, path);

    return rewriteFile({ path, moves, pattern, isPinned });
  };

  yield* Effect.forEach(files, rewritten, { concurrency: 1, discard: true });
});

/** Whether the pass rewrites a file: one on disk of a text extension, or a plain file that names paths, not kept. */
function isRewritten({ path, kept, deleted }: IsRewrittenInput): boolean {
  const isText = TEXT_EXTENSIONS.has(extname(path)) || PLAIN_FILES.has(basename(path));

  /** Whether the kept path is the file or a folder that holds it. */
  const isHolding: (held: string) => boolean = (held) =>
    path === held || path.startsWith(folderPrefixPath({ folder: held }));

  return isText && !deleted.has(path) && !kept.some(isHolding);
}
