import { finish, reportExit } from '@mechane/program';
import type { FailureLines } from '@mechane/program';
import { Effect, Match } from 'effect';
import { runMove } from './run-move.ts';
import type { MoveFailure } from './types.ts';

/** The move program's name, which prefixes each diagnostic it writes. */
const PROGRAM = 'move';

/** How the move program ends: every step through the named one applied, or a step that failed. */
const MoveStatus = { Moved: 0, Failed: 1 } as const;

/** What each failure of a run could not do, and why. */
const FAILURE_LINES: Readonly<FailureLines<MoveFailure>> = {
  InputUnreadable: ({ path, reason }) => `read ${path}: ${reason}`,
  FileUnwritable: ({ path, reason }) => `write ${path}: ${reason}`,
  MoveRefused: ({ path, reason }) => `move ${path}: ${reason}`,
  ProcessFailed: ({ command, reason }) => `run ${command}: ${reason}`,
};

/** Applies the move map's steps through the one the command line names, then ends with the run's status. */
async function main(): Promise<void> {
  const exit = await Effect.runPromiseExit(runMove());

  const status = reportExit({
    exit,
    program: PROGRAM,
    operation: 'apply the move map',
    describe: ({ failure }) => Match.valueTags(failure, FAILURE_LINES),
    succeeded: () => MoveStatus.Moved,
    failed: MoveStatus.Failed,
  });

  finish({ status });
}

await main();
