import { createModelCallToUIChunkTransform } from '@ai-sdk/workflow';
import type { ModelCallStreamPart } from '@ai-sdk/workflow';
import { PresentationOutput } from '@mechane/protocol/presentation';
import { HttpHeader } from '@mechane/records';
import { createUIMessageStreamResponse, readUIMessageStream } from 'ai';
import type { UIMessage, UIMessageChunk } from 'ai';
import { getRun } from 'workflow/api';
import { withRuntimeStore } from '../store/runtime-store.ts';
import { toolEvidence } from './tool-evidence.ts';
import type { RunSelection } from './types.ts';

type UIStreamInput = { readonly runId: string; readonly workflowId: string; readonly cursor?: number };

type ReadRunUIStreamInput = RunSelection & { readonly cursor?: number };
type PublicProjectionInput = { readonly runId: string };
const WORKFLOW_RUN_HEADER = 'x-workflow-run-id';

function publicProjection({ runId }: PublicProjectionInput): TransformStream<UIMessageChunk, UIMessageChunk> {
  const toolNames = new Map<string, string>();

  return new TransformStream({
    transform(chunk, controller) {
      if (chunk.type === 'start') {
        controller.enqueue({ type: 'start', messageId: runId, messageMetadata: { runId } });

        return;
      }

      if (chunk.type === 'tool-input-start') {
        toolNames.set(chunk.toolCallId, chunk.toolName);
        controller.enqueue({ type: chunk.type, toolCallId: chunk.toolCallId, toolName: chunk.toolName });

        return;
      }

      if (chunk.type === 'tool-input-delta') {
        controller.enqueue({ type: chunk.type, toolCallId: chunk.toolCallId, inputTextDelta: '' });

        return;
      }

      if (chunk.type === 'tool-input-available') {
        toolNames.set(chunk.toolCallId, chunk.toolName);
        controller.enqueue({ type: chunk.type, toolCallId: chunk.toolCallId, toolName: chunk.toolName, input: {} });

        return;
      }

      if (chunk.type === 'tool-input-error') {
        toolNames.set(chunk.toolCallId, chunk.toolName);
        controller.enqueue({
          type: chunk.type,
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          input: {},
          errorText: 'The tool input was not accepted.',
        });

        return;
      }

      if (chunk.type === 'tool-output-available') {
        const presentation = PresentationOutput.safeParse(chunk.output);

        if (toolNames.get(chunk.toolCallId) === 'render_ui' && presentation.success) {
          controller.enqueue({ type: chunk.type, toolCallId: chunk.toolCallId, output: presentation.data });
          controller.enqueue({
            type: 'data-spec',
            id: chunk.toolCallId,
            data: { type: 'flat', spec: presentation.data.spec },
          });

          return;
        }

        controller.enqueue({ type: chunk.type, toolCallId: chunk.toolCallId, output: toolEvidence(chunk.output) });

        return;
      }

      if (chunk.type === 'tool-output-error') {
        controller.enqueue({ type: chunk.type, toolCallId: chunk.toolCallId, errorText: 'The tool did not complete.' });

        return;
      }

      if (chunk.type === 'error') {
        controller.enqueue({ type: 'error', errorText: 'The run did not finish. See its status for recovery.' });

        return;
      }

      if (chunk.type === 'message-metadata') {
        controller.enqueue({ type: 'message-metadata', messageMetadata: { runId } });

        return;
      }

      if (chunk.type === 'finish') {
        if (chunk.finishReason !== undefined) {
          controller.enqueue({ type: 'finish', finishReason: chunk.finishReason, messageMetadata: { runId } });

          return;
        }

        controller.enqueue({ type: 'finish', messageMetadata: { runId } });

        return;
      }

      if ('providerMetadata' in chunk) {
        const { providerMetadata: _providerMetadata, ...publicChunk } = chunk;

        controller.enqueue(publicChunk);

        return;
      }

      controller.enqueue(chunk);
    },
  });
}

function skipChunks(cursor: number): TransformStream<UIMessageChunk, UIMessageChunk> {
  const state = { position: 0 };

  return new TransformStream({
    transform(chunk, controller) {
      if (state.position >= cursor) {
        controller.enqueue(chunk);
      }

      state.position += 1;
    },
  });
}

function runUIStream({ runId, workflowId, cursor = 0 }: UIStreamInput): ReadableStream<UIMessageChunk> {
  if (!Number.isSafeInteger(cursor) || cursor < 0) {
    throw new Error('Invalid stream cursor');
  }

  const source = getRun(workflowId).getReadable<ModelCallStreamPart>({ startIndex: 0 });
  const projection = projectUIStream({ runId, source });

  // JSON presentations add UI chunks. Resume counts the published stream after projection, never raw model chunks.
  return projection.pipeThrough(skipChunks(cursor));
}

function projectUIStream({
  runId,
  source,
}: {
  readonly runId: string;
  readonly source: ReadableStream<ModelCallStreamPart>;
}): ReadableStream<UIMessageChunk> {
  return source.pipeThrough(createModelCallToUIChunkTransform()).pipeThrough(publicProjection({ runId }));
}

function takeChunks(count: number): TransformStream<ModelCallStreamPart, ModelCallStreamPart> {
  const state = { remaining: count };

  return new TransformStream({
    transform(chunk, controller) {
      controller.enqueue(chunk);

      state.remaining -= 1;

      if (state.remaining === 0) {
        controller.terminate();
      }
    },
  });
}

export async function readRunUIStream({ workspaceId, runId, cursor }: ReadRunUIStreamInput): Promise<Response> {
  const run = await withRuntimeStore(async (store) => await store.getRun({ workspaceId, runId }));

  if (run === null || run.workflowId === null) {
    throw new Error('Run stream is unavailable');
  }

  return createUIMessageStreamResponse({
    stream: runUIStream({ runId, workflowId: run.workflowId, cursor: cursor ?? 0 }),
    headers: { [WORKFLOW_RUN_HEADER]: run.workflowId, [HttpHeader.CacheControl]: 'no-store' },
  });
}

export async function readCompletedUIMessage(input: UIStreamInput): Promise<UIMessage | null> {
  const source = getRun(input.workflowId).getReadable<ModelCallStreamPart>({ startIndex: 0 });
  const tailIndex = await source.getTailIndex();

  if (tailIndex < 0) {
    await source.cancel();

    return null;
  }

  const snapshot = source.pipeThrough(takeChunks(tailIndex + 1));
  const stream = projectUIStream({ runId: input.runId, source: snapshot });
  const reader = readUIMessageStream({ stream }).getReader();

  try {
    const first = await reader.read();

    if (first.done) {
      return null;
    }

    let completedMessage = first.value;
    let next = await reader.read();

    while (!next.done) {
      completedMessage = next.value;
      next = await reader.read();
    }

    return completedMessage;
  } finally {
    reader.releaseLock();
  }
}
