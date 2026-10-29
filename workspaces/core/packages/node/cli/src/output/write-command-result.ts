import { COMMAND_OUTPUTS } from '@mechane/cli-kernel';
import type { CommandInvocation, CommandResult } from '@mechane/cli-kernel';
import { OutputMode } from '@mechane/commands';
import type { CommandName } from '@mechane/commands';
import { writeResult } from '@mechane/program';
import { Option, Schema } from 'effect';
import { RecordKind } from './constants.ts';
import { renderDocument } from './render-document.ts';
import { renderLine } from './render-line.ts';

type WriteCommandResultInput<N extends CommandName> = {
  readonly invocation: CommandInvocation<N>;
  readonly result: CommandResult<N>;
};

/** A command's result in an output mode: its own lines, or its record, encoded, as the mode writes it. */
type ResultLinesInput = {
  readonly output: OutputMode;
  readonly command: CommandName;
  readonly lines: ReadonlyArray<string>;
  readonly encoded: unknown;
};

/**
 * Writes a command's result to standard output in the invocation's output mode: its lines for a person, or its record,
 * which the command's output schema encodes once, for a program.
 */
export function writeCommandResult<N extends CommandName>({ invocation, result }: WriteCommandResultInput<N>): void {
  const { output, command } = invocation;
  const encoded = Schema.encodeSync(COMMAND_OUTPUTS[command])(result.result);

  for (const line of resultLines({ output, command, lines: result.lines, encoded })) {
    writeResult({ line });
  }
}

/** The lines that write a command's result in its output mode. */
function resultLines({ output, command, lines, encoded }: ResultLinesInput): ReadonlyArray<string> {
  switch (output) {
    case OutputMode.Human:
      return lines;
    case OutputMode.Json:
      return [renderDocument({ command: Option.some(command), result: Option.some(encoded), errors: [] })];
    case OutputMode.Jsonl:
      return [renderLine({ line: { record: RecordKind.Result, command, result: encoded } })];
  }
}
