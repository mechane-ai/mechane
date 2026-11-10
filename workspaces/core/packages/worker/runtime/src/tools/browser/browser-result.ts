import { BrowserEvidenceProgress } from '@mechane/protocol';
import type { BrowserResult } from '@mechane/sandbox-wire';
import { Schema } from 'effect';

const BROWSER_TOOL_MAX_BYTES = 1_048_576;

const BrowserToolReceipt = Schema.Struct({
  executionId: Schema.String,
  ...BrowserEvidenceProgress.fields,
  viewerUrl: Schema.NullOr(Schema.String),
  hasImageInput: Schema.Boolean,
});

/** Durable tool results contain bounded metadata and a preview, never the full evidence bytes. */
export type BrowserToolResult = typeof BrowserToolReceipt.Encoded;

/** Replayed native receipts are validated before they become model-visible tool outputs. */
export function readBrowserToolResult(value: unknown): BrowserToolResult {
  const decoded = Schema.decodeUnknownSync(BrowserToolReceipt, { onExcessProperty: 'error' })(value);

  return Schema.encodeSync(BrowserToolReceipt)(decoded);
}

function resultBytes(result: BrowserToolResult): number {
  const encoder = new TextEncoder();
  const toolBytes = encoder.encode(JSON.stringify(result)).byteLength;
  const modelOutput = browserModelOutput({ output: result });
  const modelBytes = encoder.encode(JSON.stringify(modelOutput)).byteLength;

  return Math.max(toolBytes, modelBytes);
}

/** Accessibility targets yield to the actual image preview when their combined payload reaches the tool cap. */
export function boundBrowserToolResult(result: BrowserToolResult): BrowserToolResult {
  if (resultBytes(result) <= BROWSER_TOOL_MAX_BYTES) {
    return result;
  }

  const progress = result.progress;

  if (progress._tag === 'Ready' && progress.response.result._tag === 'Observation') {
    const observation = progress.response.result;
    const targets = [...observation.targets];

    while (targets.length > 0) {
      targets.pop();

      const bounded = {
        ...result,
        progress: {
          ...progress,
          response: { ...progress.response, result: { ...observation, targets, isTruncated: true } },
        },
      };

      if (resultBytes(bounded) <= BROWSER_TOOL_MAX_BYTES) {
        return bounded;
      }
    }
  }

  return { ...result, progress: { _tag: 'Failed', reason: 'The browser result exceeded its delivery limit' } };
}

/** AI SDK receives the bounded preview as native image content, alongside text that excludes its base64 bytes. */
export function browserModelOutput({ output }: { readonly output: BrowserToolResult }) {
  const progress = output.progress;

  const result: typeof BrowserResult.Encoded | null = (() => {
    if (progress._tag === 'Ready') {
      return progress.response.result;
    }

    return null;
  })();

  if (result !== null && 'preview' in result && progress._tag === 'Ready') {
    const { preview, ...details } = result;

    const text = JSON.stringify({
      ...output,
      progress: { ...progress, response: { ...progress.response, result: details } },
    });

    if (output.hasImageInput) {
      return {
        type: 'content' as const,
        value: [
          { type: 'text' as const, text },
          {
            type: 'file' as const,
            mediaType: preview.mediaType,
            data: { type: 'data' as const, data: preview.base64 },
          },
        ],
      };
    }

    return { type: 'text' as const, value: text };
  }

  return { type: 'text' as const, value: JSON.stringify(output) };
}
