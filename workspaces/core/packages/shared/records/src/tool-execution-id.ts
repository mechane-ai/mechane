import { Hex } from 'effect/encoding';
import type { ModelToolCallId } from './model-tool-call-id.schemas.ts';
import { recordIdFromDigest } from './record-id-from-digest.ts';
import type { RecordId } from './schemas.ts';

type ToolExecutionIdInput = { readonly runId: RecordId; readonly toolCallId: typeof ModelToolCallId.Encoded };

/** Tool receipts keep their identity across retries and historical trace reconstruction. */
export async function toolExecutionId({ runId, toolCallId }: ToolExecutionIdInput): Promise<string> {
  const inputText = JSON.stringify(['mechane-tool', runId, toolCallId]);
  const input = new TextEncoder().encode(inputText);
  const hashed = await crypto.subtle.digest('SHA-256', input);
  const encodedDigest = new Uint8Array(hashed);
  const digest = Hex.encode(encodedDigest);

  return recordIdFromDigest({ digest });
}
