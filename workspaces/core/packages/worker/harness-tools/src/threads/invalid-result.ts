import { failedResult } from '../failed-result.ts';
import type { IssueInput, ToolResult } from '../types.ts';
import { ThreadDiagnostic } from './constants.ts';

/** What a threads tool answers for arguments its schema refuses. */
export function invalidResult({ issue }: IssueInput): ToolResult {
  return failedResult({ code: ThreadDiagnostic.Invalid, message: `The thread call is invalid: ${issue}` });
}
