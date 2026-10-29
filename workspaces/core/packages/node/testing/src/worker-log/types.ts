import type { LogLine } from '@mechane/protocol';

/** The Worker's lines of a stack's log: those that decode, and the count of those that do not. */
export type WorkerLog = { readonly lines: ReadonlyArray<LogLine>; readonly undecodedLines: number };
