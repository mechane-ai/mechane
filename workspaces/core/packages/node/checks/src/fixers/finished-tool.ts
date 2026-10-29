import { FINISHED_STATUSES, InputUnreadable, LINT_TIMEOUT, toolOutput } from '@mechane/checks-kernel';
import { exitStatusText } from '@mechane/program';
import { Effect, Option } from 'effect';

/** A linter that rewrites files: its command and arguments, and the variables it inherits. */
type FinishedToolInput = {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly inherited: Readonly<Record<string, string>>;
};

/**
 * Runs a linter that rewrites files to its end. It exits nonzero while findings it cannot fix remain, which the check
 * reports, so only a run that did not finish fails.
 */
export const finishedTool = Effect.fn('finishedTool')(function* ({
  command,
  args,
  inherited,
}: FinishedToolInput): Effect.fn.Return<void, InputUnreadable> {
  const { status, stderr } = yield* toolOutput({ command, args, inherited, timeout: LINT_TIMEOUT });

  if (!Option.exists(status, (code) => FINISHED_STATUSES.has(code))) {
    return yield* new InputUnreadable({
      path: command,
      reason: `it exited ${exitStatusText({ status })}: ${stderr.trim()}`,
    });
  }
});
