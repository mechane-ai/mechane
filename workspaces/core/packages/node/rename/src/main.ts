import { finish, reportExit } from '@mechane/program';
import type { FailureLines } from '@mechane/program';
import { Effect, Match } from 'effect';
import { runRename } from './run-rename.ts';
import type { RenameFailure } from './types.ts';

/** The rename program's name, which prefixes each diagnostic it writes. */
const PROGRAM = 'rename';

/** How the rename program ends: every pass of the maps applied, or a pass that failed. */
const RenameStatus = { Renamed: 0, Failed: 1 } as const;

/** What the command line asks for when it names no binding, which a refused command line's line ends with. */
const NAMES_HINT =
  'name a binding and its new name, then its file when two files declare it, such as `startStack launchStack`';

/** The step each failure could not take, and why. */
const FAILURE_LINES: Readonly<FailureLines<RenameFailure>> = {
  FileFailed: ({ step, path, reason }) => `${step} ${path}: ${reason}`,
  MoveFailed: ({ from, to, reason }) => `move ${from} to ${to}: ${reason}`,
  MoveTaken: ({ from, to }) => `move ${from} to ${to}: a file is already there`,
  NamesRefused: ({ names }) => `read the names ${names.join(' ')}: ${NAMES_HINT}`,
  DeclarationMissing: ({ name }) => `find the declaration of ${name}: no TypeScript file of the workspace declares it`,
  DeclarationShared: ({ name, paths }) =>
    `find the declaration of ${name}: ${paths.join(', ')} declare it; name one after the new name`,
  NothingRenamed: ({ name, file }) => `rename ${name} in ${file}: nothing renames`,
  ServerRefused: ({ reason }) => `start the language server: ${reason}`,
  ServerExited: ({ status }) => `run the language server: it exited ${status}`,
};

/** Renames the binding the command line names, or applies the committed rename maps to the factory. */
async function main(): Promise<void> {
  const exit = await Effect.runPromiseExit(runRename());

  const status = reportExit({
    exit,
    program: PROGRAM,
    operation: 'apply the rename map',
    describe: ({ failure }) => Match.valueTags(failure, FAILURE_LINES),
    succeeded: () => RenameStatus.Renamed,
    failed: RenameStatus.Failed,
  });

  finish({ status });
}

await main();
