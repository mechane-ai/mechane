import { LogLine } from '@mechane/protocol';
import { Schema } from 'effect';

type WriteLogInput = { readonly line: LogLine };

/** Writes one line to the Worker's log, the only output the Worker and its objects make there. */
export function writeLog({ line }: WriteLogInput): void {
  console.log(Schema.encodeSync(Schema.fromJsonString(LogLine))(line));
}
