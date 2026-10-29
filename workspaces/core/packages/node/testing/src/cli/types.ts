import type { ProcessRun } from '@mechane/program';
import type { Stack } from '@mechane/stack';

/** A command to run against the stack with a CLI binary, such as one install.sh installed, and its own variables. */
export type BinaryCommandInput = {
  readonly stack: Stack;
  readonly binary: string;
  readonly args: ReadonlyArray<string>;
  readonly environment: Readonly<Record<string, string>>;
};

/** A command to run with the CLI binary `mise run build:cli` compiles. */
export type CliCommandInput = Omit<BinaryCommandInput, 'binary'>;

/** A finished CLI run: the command's arguments, and how its process ended. */
export type FinishedCliInput = { readonly args: ReadonlyArray<string>; readonly run: ProcessRun };
