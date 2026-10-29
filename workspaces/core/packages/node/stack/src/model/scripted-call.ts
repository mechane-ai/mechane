import { Option, Result, Schema } from 'effect';
import { COMMAND_PREFIX } from '../constants.ts';
import { TOOL_CALL_PREFIX } from './constants.ts';
import type { ScriptedCall } from './types.ts';

/** A line that calls a tool: the prefix, the tool's name, one space, and the call's arguments as one JSON object. */
const TOOL_CALL_LINE: Readonly<RegExp> = new RegExp(`^${TOOL_CALL_PREFIX}(?<tool>[a-z][a-z0-9_]*) (?<input>\\{.*\\})$`);

/**
 * The tool the scripted upstream calls with a command: the shell tool every mech is offered, under the name models are
 * trained to call.
 */
const SHELL_TOOL = 'bash';

/** The named parts of a line that calls a tool, as its pattern captures them. */
const ToolCallLineParts = Schema.Struct({ tool: Schema.String, input: Schema.String });

type ToolCallLineParts = typeof ToolCallLineParts.Type;

/** A tool call line's arguments: one JSON object, which pi then checks against the tool's parameters. */
const ToolCallInput = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));

type ToolCallInput = typeof ToolCallInput.Type;

type ScriptLineInput = { readonly line: string };

/**
 * One line's call: the shell tool with the command after `$ `, or the tool a line names with its JSON object; none for
 * a line that calls nothing.
 */
export function scriptedCall({ line }: ScriptLineInput): Option.Option<ScriptedCall> {
  if (line.startsWith(COMMAND_PREFIX)) {
    return Option.some({ name: SHELL_TOOL, arguments: JSON.stringify({ command: line.slice(COMMAND_PREFIX.length) }) });
  }

  const lineParts: (found: RegExpExecArray) => Option.Option<ToolCallLineParts> = (found) =>
    Result.getSuccess(Schema.decodeUnknownResult(ToolCallLineParts)(found.groups));

  const parts = Option.flatMap(Option.fromNullishOr(TOOL_CALL_LINE.exec(line)), lineParts);

  const isCallInput: (parts: ToolCallLineParts) => boolean = ({ input }) =>
    Result.isSuccess(Schema.decodeUnknownResult(ToolCallInput)(input));

  return Option.map(Option.filter(parts, isCallInput), ({ tool, input }) => ({ name: tool, arguments: input }));
}
