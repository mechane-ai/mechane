import { Schema } from 'effect';
import { readModelToolResult } from '../model-result.ts';
import type { ModelToolResultInput } from '../model-result.ts';

const BashResult = Schema.Struct({
  status: Schema.String,
  executionId: Schema.String,
  output: Schema.optionalKey(Schema.String),
  exitCode: Schema.optionalKey(Schema.Number),
  message: Schema.optionalKey(Schema.String),
});

export async function readBashResult(input: ModelToolResultInput) {
  return Schema.decodeUnknownSync(BashResult)(await readModelToolResult(input));
}
