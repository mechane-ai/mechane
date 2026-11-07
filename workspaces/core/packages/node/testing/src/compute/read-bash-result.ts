import type { ModelFixture } from '@mechane/stack';
import { Schema } from 'effect';

const BASH_RESULT_WAIT_MS = 30_000;

const ToolMessage = Schema.Struct({
  role: Schema.Literal('tool'),
  tool_call_id: Schema.String,
  content: Schema.String,
});

const BashResult = Schema.Struct({
  status: Schema.String,
  executionId: Schema.String,
  output: Schema.optionalKey(Schema.String),
  exitCode: Schema.optionalKey(Schema.Number),
});

type ReadBashResultInput = {
  readonly model: ModelFixture;
  readonly marker: string;
  readonly toolCallId: string;
  readonly index?: number;
  readonly timeoutMs?: number;
};

export async function readBashResult({
  model,
  marker,
  toolCallId,
  index = 1,
  timeoutMs = BASH_RESULT_WAIT_MS,
}: ReadBashResultInput) {
  const call = await model.waitForCall({ marker, index, timeoutMs });
  const messages = Schema.decodeUnknownSync(Schema.Array(Schema.Unknown))(call.body['messages']);

  const message: unknown = messages.find(
    (candidate) => Schema.is(ToolMessage)(candidate) && candidate.tool_call_id === toolCallId,
  );

  if (!Schema.is(ToolMessage)(message)) {
    throw new Error('The model request has no result for its shell tool call');
  }

  const decoded = Schema.decodeUnknownResult(Schema.fromJsonString(BashResult))(message.content);

  if (decoded._tag === 'Failure') {
    throw new Error('The shell tool returned an invalid result');
  }

  return decoded.success;
}
