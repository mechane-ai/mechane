import { errorDiagnostic } from './error-diagnostic.ts';
import type { DiagnosticInput, ToolResult } from './types.ts';

/** A result with no output and one error, which tells the model why. */
export function failedResult({ code, message }: DiagnosticInput): ToolResult {
  return { isError: true, diagnostics: [errorDiagnostic({ code, message })] };
}
