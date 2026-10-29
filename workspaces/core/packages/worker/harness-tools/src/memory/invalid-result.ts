import { failedResult } from '../failed-result.ts';
import type { IssueInput, ToolResult } from '../types.ts';
import { MemoryDiagnostic } from './constants.ts';

/** What a memory tool answers for arguments its schema refuses. */
export function invalidResult({ issue }: IssueInput): ToolResult {
  return failedResult({ code: MemoryDiagnostic.Invalid, message: `The memory call is invalid: ${issue}` });
}
