import { LogLine } from '@mechane/protocol';
import { Array, Option, Result, Schema } from 'effect';
import type { WorkerLog } from './types.ts';

/** A line the Worker or one of its objects wrote to the console, as celld's log holds it, with what it wrote. */
const WORKER_LINE = / INFO cell_console: (.*)$/;

/** The group of a Worker line's pattern that holds what the Worker wrote. */
const WRITTEN_GROUP = 1;

/** What the Worker wrote on a line of the log, a log line as JSON when it is one. */
const WrittenLine = Schema.fromJsonString(LogLine);

/** A stack's log as text. */
type LogTextInput = { readonly text: string };

/**
 * The lines of a stack's log that the Worker wrote, which celld writes after its console target. It answers each that
 * decodes as a log line, and how many do not. The smoke never quotes one that does not, since such a line is free
 * text.
 */
export function workerLines({ text }: LogTextInput): WorkerLog {
  const written: (line: string) => ReadonlyArray<string> = (line) =>
    Option.toArray(Option.flatMap(Option.fromNullishOr(WORKER_LINE.exec(line)), Array.get(WRITTEN_GROUP)));

  const decoded: (line: string) => Option.Option<LogLine> = (line) =>
    Result.getSuccess(Schema.decodeUnknownResult(WrittenLine)(line));

  const lines = text.split('\n').flatMap(written).map(decoded);

  return { lines: Array.getSomes(lines), undecodedLines: lines.filter(Option.isNone).length };
}
