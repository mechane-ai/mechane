import type { ModelFixture } from '@mechane/stack';
import { Schema } from 'effect';

const TOOL_RESULT_WAIT_MS = 30_000;

const ToolMessage = Schema.Struct({
  role: Schema.Literal('tool'),
  tool_call_id: Schema.String,
  content: Schema.String,
});

export type ModelToolResultInput = {
  readonly model: ModelFixture;
  readonly marker: string;
  readonly toolCallId: string;
  readonly index?: number;
  readonly timeoutMs?: number;
};

export async function readModelToolText({
  model,
  marker,
  toolCallId,
  index = 1,
  timeoutMs = TOOL_RESULT_WAIT_MS,
}: ModelToolResultInput): Promise<string> {
  const call = await model.waitForCall({ marker, index, timeoutMs });
  const messages = Schema.decodeUnknownSync(Schema.Array(Schema.Unknown))(call.body['messages']);

  const message: unknown = messages.find(
    (candidate) => Schema.is(ToolMessage)(candidate) && candidate.tool_call_id === toolCallId,
  );

  if (!Schema.is(ToolMessage)(message)) {
    throw new Error('The model request has no result for its tool call');
  }

  return message.content;
}

export async function readModelToolResult(input: ModelToolResultInput): Promise<unknown> {
  const output = await readModelToolText(input);
  const diagnosticStart = output.indexOf('\n');

  if (diagnosticStart === -1) {
    return JSON.parse(output);
  }

  return JSON.parse(output.slice(0, diagnosticStart));
}
