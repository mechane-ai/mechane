import { runCli } from '@mechane/testing';
import type { ScenarioFailure, SearchedText } from '@mechane/testing';
import { Effect, Schema } from 'effect';
import type { AccountInput } from './types.ts';

/** The commands whose output the token scan reads beside the approvals': one of each kind a key can make. */
const SCANNED_COMMANDS = [
  ['auth', 'status'],
  ['key', 'list'],
  ['workspace', 'list'],
  ['auth', 'logout'],
] as const;

/** One of the scanned commands. */
type ScannedCommand = (typeof SCANNED_COMMANDS)[number];

/** A scanned command to run as the account. */
type CommandOutputInput = AccountInput & { readonly args: ScannedCommand };

/** The output of one command of each kind a key makes, ending with the logout that revokes the login key. */
export const commandOutputs = Effect.fn('commandOutputs')(function* ({
  stack,
  account,
}: AccountInput): Effect.fn.Return<ReadonlyArray<SearchedText>, ScenarioFailure> {
  const output: (args: ScannedCommand) => Effect.Effect<SearchedText, ScenarioFailure> = (args) =>
    commandOutput({ stack, account, args });

  return yield* Effect.forEach(SCANNED_COMMANDS, output, { concurrency: 1 });
});

/** Runs one scanned command as the account, and names its output by the command. */
const commandOutput = Effect.fn('commandOutput')(function* ({
  stack,
  account,
  args,
}: CommandOutputInput): Effect.fn.Return<SearchedText, ScenarioFailure> {
  const { output } = yield* runCli({ stack, args, environment: account.environment, result: Schema.Unknown });

  return { name: `the output of mechane ${args.join(' ')}`, text: output };
});
