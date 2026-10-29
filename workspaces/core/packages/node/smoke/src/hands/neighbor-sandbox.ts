import type { Stack } from '@mechane/stack';
import { talkingMech } from '@mechane/testing';
import type { Account, ScenarioFailure } from '@mechane/testing';
import { Effect, Option } from 'effect';
import type { Scope } from 'effect';
import { commandReply } from './command-reply.ts';
import { HOME_VARIABLE } from './constants.ts';

type NeighborSandboxInput = { readonly stack: Stack; readonly account: Account; readonly model: string };

type ReplyInput = { readonly reply: string };

/** A variable `env` printed: its name and its value. */
type VariableEntry = readonly [string, string];

/** A second mech's sandbox: the entries of its home, the names of its variables, sorted, and its home's path. */
type NeighborSandbox = {
  readonly listed: ReadonlyArray<string>;
  readonly names: ReadonlyArray<string>;
  /** The home the sandbox's executions see, none when `env` printed no home. */
  readonly home: Option.Option<string>;
};

/** What a second mech of the workspace finds in its own sandbox: its home's entries, and its variables. */
export const neighborSandbox = Effect.fn('neighborSandbox')(function* ({
  stack,
  account,
  model,
}: NeighborSandboxInput): Effect.fn.Return<NeighborSandbox, ScenarioFailure, Scope.Scope> {
  const neighbor = yield* talkingMech({ stack, account, model });
  const listing = yield* commandReply({ mech: neighbor, command: 'ls -a' });
  const printed = yield* commandReply({ mech: neighbor, command: 'env' });
  const variables = environmentVariables({ reply: printed });

  return {
    listed: listing.split('\n'),
    names: [...variables.keys()].toSorted(),
    home: Option.fromNullishOr(variables.get(HOME_VARIABLE)),
  };
});

/** The variables `env` printed, by name; no value the scenario's executions see holds a newline. */
function environmentVariables({ reply }: ReplyInput): ReadonlyMap<string, string> {
  const entry: (line: string) => VariableEntry = (line) => [
    line.slice(0, line.indexOf('=')),
    line.slice(line.indexOf('=') + 1),
  ];

  return new Map(
    reply
      .split('\n')
      .filter((line) => line.includes('='))
      .map(entry),
  );
}
