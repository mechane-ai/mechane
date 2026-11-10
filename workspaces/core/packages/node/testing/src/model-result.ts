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

export async function readModelToolResult({
  model,
  marker,
  toolCallId,
  index = 1,
  timeoutMs = TOOL_RESULT_WAIT_MS,
}: ModelToolResultInput): Promise<unknown> {
  const call = await model.waitForCall({ marker, index, timeoutMs });
  const messages = Schema.decodeUnknownSync(Schema.Array(Schema.Unknown))(call.body['messages']);

  const message: unknown = messages.find(
    (candidate) => Schema.is(ToolMessage)(candidate) && candidate.tool_call_id === toolCallId,
  );

  if (!Schema.is(ToolMessage)(message)) {
    throw new Error('The model request has no result for its tool call');
  }

  // Runtime receipts occupy one JSON line; Pi may append diagnostics after it.
  const diagnosticStart = message.content.indexOf('\n');

  if (diagnosticStart === -1) {
    return JSON.parse(message.content);
  }

  const result = message.content.slice(0, diagnosticStart);

  return JSON.parse(result);
}
