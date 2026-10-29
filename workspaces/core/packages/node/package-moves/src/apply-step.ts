import { trackedFiles, WORKSPACE_FOLDER, workspaceMembers, writeChanges } from '@mechane/checks-kernel';
import type { FileChange, MoveStep } from '@mechane/checks-kernel';
import { finishedProcess } from '@mechane/program';
import { Duration, Effect, Option } from 'effect';
import { join } from 'node:path';
import { moveDeclarations } from './declarations/move-declarations.ts';
import { rewrittenTree } from './package-imports/rewritten-tree.ts';
import { manifestChanges } from './package-manifests/manifest-changes.ts';
import { workspaceChanges } from './package-manifests/workspace-changes.ts';
import type { RewrittenSource } from './packages.types.ts';
import { rewritePaths } from './paths/rewrite-paths.ts';
import { relocateFiles } from './relocate-files.ts';
import { removeEmptyFolders } from './remove-empty-folders.ts';
import { stepLayout } from './step-layout.ts';
import type { MoveFailure } from './types.ts';

/** The rule registry's generator, which writes each member's compiler configuration and every tool's settings. */
const GENERATOR = join(WORKSPACE_FOLDER, 'packages/node/rule-generator/src/main.ts');

/** How long the generator may take to write the registry's files. */
const GENERATE_TIMEOUT = Duration.minutes(2);

/** How long pnpm may take to link the workspace's members again and write the lockfile. */
const INSTALL_TIMEOUT = Duration.minutes(5);

/** A step, and the variables its children inherit. */
type ApplyStepInput = { readonly step: MoveStep; readonly inherited: Readonly<Record<string, string>> };

/** The TypeScript files after the step. */
type SourceChangesInput = { readonly sources: ReadonlyArray<RewrittenSource> };

/**
 * Applies one step: its declarations move, then its files, with each import naming where its names land. Each entry
 * exports what another member takes, each manifest declares what its files import, and every text names the new paths.
 * Then pnpm links the members, and the registry's generator writes each one's configuration for a later step.
 */
export const applyStep = Effect.fn('applyStep')(function* ({
  step,
  inherited,
}: ApplyStepInput): Effect.fn.Return<void, MoveFailure> {
  yield* moveDeclarations({ declarations: step.declarations });

  const members = yield* workspaceMembers();
  const files = yield* trackedFiles({ inherited });
  const layout = yield* stepLayout({ step, members, files });
  const sources = yield* rewrittenTree({ layout, members });
  const { changes, emptied } = yield* manifestChanges({ layout, members, sources, files });

  yield* relocateFiles({ moves: layout.moves, files, sources });
  yield* writeChanges({ changes: sourceChanges({ sources }) });
  yield* writeChanges({ changes: [...changes, ...(yield* workspaceChanges({ step, layout, emptied }))] });
  yield* removeEmptyFolders({ moves: layout.moves, files });
  yield* rewritePaths({ moves: layout.moves, inherited });
  yield* finishedProcess({
    command: 'pnpm',
    args: ['--dir', WORKSPACE_FOLDER, 'install', '--prefer-offline'],
    environment: inherited,
    timeout: INSTALL_TIMEOUT,
  });
  yield* finishedProcess({
    command: 'node',
    args: [GENERATOR, 'write'],
    environment: inherited,
    timeout: GENERATE_TIMEOUT,
  });
});

/**
 * Each changed file's text at its path after the step, after the deletion of each moved file's path before it. A file
 * the step empties, such as the entry of a member whose files all leave, is deleted.
 */
function sourceChanges({ sources }: SourceChangesInput): ReadonlyArray<FileChange> {
  const changed = sources.filter(({ isChanged }) => isChanged);

  /** The deletion of a moved file's path before the step. */
  const deletedFrom: (source: RewrittenSource) => FileChange = ({ from }) => ({ path: from, text: Option.none() });

  /** The file's text at its path after the step, none once the step empties it. */
  const written: (source: RewrittenSource) => FileChange = ({ path, text }) => ({
    path,
    text: Option.liftPredicate(text, (kept) => kept !== ''),
  });

  return [...changed.filter(({ from, path }) => from !== path).map(deletedFrom), ...changed.map(written)];
}
