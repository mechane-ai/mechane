import { TOOL_CALL_PREFIX } from '@mechane/stack';

/** A line of a person's script that calls a tool with its arguments. */
type ToolCallLineInput = { readonly tool: string; readonly input: Readonly<Record<string, string>> };

/** A line of a person's script that the scripted upstream turns into a call of the tool with these arguments. */
export function toolCallLine({ tool, input }: ToolCallLineInput): string {
  return `${TOOL_CALL_PREFIX}${tool} ${JSON.stringify(input)}`;
}
