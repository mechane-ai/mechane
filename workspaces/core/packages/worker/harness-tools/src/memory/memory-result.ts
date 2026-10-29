import { MEMORIES_PER_MECH } from '@mechane/protocol';
import { Match } from 'effect';
import { failedResult } from '../failed-result.ts';
import { textResult } from '../text-result.ts';
import type { OutcomeResults, ToolResult } from '../types.ts';
import { MemoryDiagnostic } from './constants.ts';
import type { MemoryChangeOutcome } from './schemas.ts';
import type { PathInput } from './types.ts';

type MemoryResultInput = { readonly outcome: MemoryChangeOutcome; readonly path: string };

/** What each outcome tells the model of the path its call named: when a recorded change lasts, or what to do. */
const OUTCOME_RESULTS: Readonly<OutcomeResults<MemoryChangeOutcome & PathInput>> = {
  Saved: ({ path, digest }) =>
    textResult({ text: `Saved ${path} with digest ${digest}; it lasts once this turn ends with a reply` }),
  Deleted: ({ path }) => textResult({ text: `Deleted ${path}; the deletion lasts once this turn ends with a reply` }),
  Exists: ({ path }) =>
    failedResult({
      code: MemoryDiagnostic.Exists,
      message: `${path} already holds a memory: read it with memory_read, then pass its digest to replace it`,
    }),
  Changed: ({ path }) =>
    failedResult({
      code: MemoryDiagnostic.Changed,
      message: `${path} changed since you read it: read it again with memory_read`,
    }),
  Missing: ({ path }) => failedResult({ code: MemoryDiagnostic.Missing, message: `No memory is at ${path}` }),
  Full: () =>
    failedResult({
      code: MemoryDiagnostic.Full,
      message: `You keep ${MEMORIES_PER_MECH} memories already: delete or replace one first`,
    }),
};

/** What a memory tool answers for an outcome at a path: a recorded change says when it lasts, a refusal what to do. */
export function memoryResult({ outcome, path }: MemoryResultInput): ToolResult {
  return Match.valueTags({ ...outcome, path }, OUTCOME_RESULTS);
}
