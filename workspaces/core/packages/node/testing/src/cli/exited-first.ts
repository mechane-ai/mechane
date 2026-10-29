import type { ProcessFailed, RunningProcess } from '@mechane/program';
import { Effect } from 'effect';
import type { CliStep } from '../constants.ts';
import { CliFailed } from '../errors.ts';

/** A running CLI, its command as a failure names it, and the step its exit leaves untaken. */
type ExitedFirstInput = { readonly running: RunningProcess; readonly command: string; readonly step: CliStep };

/** Fails once the running CLI exits, for a wait it races, which a CLI that exits first leaves untaken. */
export const exitedFirst = Effect.fn('exitedFirst')(function* ({
  running,
  command,
  step,
}: ExitedFirstInput): Effect.fn.Return<never, CliFailed | ProcessFailed> {
  const { status, stderr } = yield* running.exited;

  return yield* new CliFailed({ command, step, status, stderr });
});
