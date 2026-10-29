import { CliOutput, startProcess } from '@mechane/program';
import type { ProcessFailed, ProcessRun } from '@mechane/program';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { cliProcess } from './cli-process.ts';
import type { BinaryCommandInput } from './types.ts';

/** Runs a CLI binary with `--output json` to its exit, which fails once the run outlives the smoke's CLI timeout. */
export const finishedCli = Effect.fn('finishedCli')(function* ({
  args,
  ...command
}: BinaryCommandInput): Effect.fn.Return<ProcessRun, ProcessFailed, Scope.Scope> {
  const running = yield* startProcess(cliProcess({ ...command, args: [...args, ...CliOutput.Json] }));

  return yield* running.exited;
}, Effect.scoped);
