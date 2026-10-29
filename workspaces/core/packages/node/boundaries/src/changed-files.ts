import {
  BASELINE_FOLDER,
  contractLock,
  decodeFile,
  FACTORY_FOLDER,
  folderPrefixPath,
  gitLines,
  lockedAssets,
  mergeBase,
  trackedFiles,
  WORKSPACE_FOLDER,
} from '@mechane/checks-kernel';
import type { InputUnreadable } from '@mechane/checks-kernel';
import { Effect, Schema } from 'effect';
import { existsSync } from 'node:fs';
import { basename, relative } from 'node:path';
import { MODULE_GRAPH } from './constants.ts';
import { withImporters } from './with-importers.ts';

/**
 * The names of the files whose change can alter a finding anywhere, so the changed set grows to every file. They are
 * the lint, format and compiler configurations, the manifests and the locks.
 */
const CONFIGURATION_NAMES: ReadonlySet<string> = new Set([
  '.oxlintrc.json',
  '.oxfmtrc.json',
  'sgconfig.yml',
  'tsconfig.base.json',
  'tsconfig.json',
  'package.json',
  'pnpm-lock.yaml',
  'mise.lock',
]);

/** The workspace's folder of lint rules and declared values, each a configuration, and of the ratchets' baselines. */
const LINT_FOLDER = 'lint/';

/** The module graph the boundaries check writes: each cruised file and the files it imports. */
const ModuleGraph = Schema.Record(Schema.String, Schema.Array(Schema.String));

type ChangedFilesInput = { readonly baseBranch: string; readonly inherited: Readonly<Record<string, string>> };

/**
 * The changed set, sorted and relative to the workspace: each file that differs from the merge base of `HEAD` and
 * `baseBranch` or that git does not track yet. Each file that imports one of them through the last cruise's graph joins
 * it. A changed configuration, which an installed contract's asset file is too, or no graph yet makes every file
 * changed; a changed baseline does not.
 */
export const changedFiles = Effect.fn('changedFiles')(function* ({
  baseBranch,
  inherited,
}: ChangedFilesInput): Effect.fn.Return<ReadonlyArray<string>, InputUnreadable> {
  const files = yield* trackedFiles({ inherited });
  const workspace = folderPrefixPath({ folder: relative(FACTORY_FOLDER, WORKSPACE_FOLDER) });

  const changed = [
    ...(yield* committedChanges({ baseBranch, inherited })),
    ...(yield* gitLines({ args: ['ls-files', '--others', '--exclude-standard', '--full-name'], inherited })),
  ];

  const lintFolder = `${workspace}${LINT_FOLDER}`;
  const baselineFolder = folderPrefixPath({ folder: `${workspace}${BASELINE_FOLDER}` });
  const lock = yield* contractLock();
  // The lint loads an installed asset in place, so its change can alter a finding anywhere.
  const assets = lockedAssets({ lock });

  const isConfiguration: (path: string) => boolean = (path) => {
    // A baseline holds data about the files it names, which the full check holds it to, so it changes no other file.
    const isLintFile = path.startsWith(lintFolder) && !path.startsWith(baselineFolder);

    return CONFIGURATION_NAMES.has(basename(path)) || isLintFile || assets.has(path);
  };

  if (changed.some(isConfiguration) || !existsSync(MODULE_GRAPH)) {
    return files;
  }

  const graph = yield* decodeFile({ path: MODULE_GRAPH, schema: ModuleGraph });
  const inWorkspace = changed.filter((path) => path.startsWith(workspace)).map((path) => path.slice(workspace.length));
  const current = new Set(files);

  // The graph is the last cruise's, so an importer it names may since have moved or gone.
  return withImporters({ files: inWorkspace, graph }).filter((file) => current.has(file));
});

/** Each file, relative to the factory, that differs from the merge base of `HEAD` and `baseBranch`. */
const committedChanges = Effect.fn('committedChanges')(function* ({
  baseBranch,
  inherited,
}: ChangedFilesInput): Effect.fn.Return<ReadonlyArray<string>, InputUnreadable> {
  const base = yield* mergeBase({ baseBranch, inherited });

  return yield* gitLines({ args: ['diff', '--name-only', '--diff-filter=d', base], inherited });
});
