import { RunOutcome } from '@mechane/cli-kernel';
import type { CommandRunInput, RunFailure } from '@mechane/cli-kernel';
import { PROGRAM } from '@mechane/commands';
import { EvalOutcome, runEval } from '@mechane/eval';
import type { WriteProgress } from '@mechane/eval';
import { writeDiagnostic } from '@mechane/program';
import { Effect } from 'effect';
import { withWorkspace } from './mechs/with-workspace.ts';

/** The outcome of the command by how its eval run ended: an incomplete run fails the command. */
const EVAL_RUN_OUTCOME: Readonly<Record<EvalOutcome, RunOutcome>> = {
  [EvalOutcome.Completed]: RunOutcome.Completed,
  [EvalOutcome.Incomplete]: RunOutcome.Incomplete,
};

/** The eval's progress goes to standard error, and its report is the command's result. */
export const runEvalRun = Effect.fn('runEvalRun')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
  write,
}: CommandRunInput<'eval run'>): Effect.fn.Return<RunOutcome, RunFailure> {
  const { suiteFile, outFolder } = input;
  const writeProgress: WriteProgress = ({ line }) => writeDiagnostic({ program: PROGRAM, line });

  const run = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: (access) => runEval({ call, access, suiteFile, outFolder, writeProgress }),
  });

  write({ result: { lines: run.lines, result: run.report } });

  return EVAL_RUN_OUTCOME[run.outcome];
});
