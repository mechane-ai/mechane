import { RunOutcome } from '@mechane/cli-kernel';
import type { CommandResult, CommandRunInput, Run, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { CommandName } from '@mechane/commands';
import { Effect } from 'effect';

/** The work of a command that answers with one result, which is written once the run ends. */
type DocumentRun<N extends CommandName> = (input: RunInput<N>) => Effect.Effect<CommandResult<N>, RunFailure>;

type DocumentRunInput<N extends CommandName> = { readonly run: DocumentRun<N> };

/** The run of a command that answers with one result: it writes that result once the work ends, which completes it. */
export function documentRun<N extends CommandName>({ run }: DocumentRunInput<N>): Run<N> {
  const documentWork = Effect.fn('documentWork')(function* ({
    write,
    ...input
  }: CommandRunInput<N>): Effect.fn.Return<RunOutcome, RunFailure> {
    const result = yield* run(input);

    write({ result });

    return RunOutcome.Completed;
  });

  return documentWork;
}
