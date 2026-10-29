import type { ToolResult } from './types.ts';

type TextInput = { readonly text: string };

/** A result of one text for the model. */
export function textResult({ text }: TextInput): ToolResult {
  return { output: [{ type: 'text', text }] };
}
