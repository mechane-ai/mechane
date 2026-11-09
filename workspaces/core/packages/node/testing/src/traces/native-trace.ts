import { HttpHeader } from '@mechane/records';
import { parseJsonEventStream, uiMessageChunkSchema } from 'ai';
import type { UIMessageChunk } from 'ai';

type ReadTraceInput = {
  readonly origin: URL;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly turnId: string;
  readonly token?: string;
  readonly startIndex?: number;
};

const TRACE_DEADLINE_MS = 120_000;

export async function readNativeTrace(input: ReadTraceInput): Promise<Response> {
  const path = nativeTracePath(input);
  const url = new URL(path, input.origin);
  const headers = new Headers();

  if (input.token !== undefined) {
    headers.set(HttpHeader.Authorization, `Bearer ${input.token}`);
  }

  if (input.startIndex !== undefined) {
    url.searchParams.set('startIndex', String(input.startIndex));
  }

  return await fetch(url, { headers, signal: AbortSignal.timeout(TRACE_DEADLINE_MS) });
}

function nativeTracePath(input: Pick<ReadTraceInput, 'workspaceId' | 'mechId' | 'turnId'>): string {
  return `/api/v1/workspaces/${encodeURIComponent(input.workspaceId)}/mechs/${encodeURIComponent(input.mechId)}/turns/${encodeURIComponent(input.turnId)}/stream`;
}

export async function readNativeChunks(response: Response): Promise<ReadonlyArray<UIMessageChunk>> {
  if (!response.ok || response.body === null) {
    throw new Error(`Native trace stream returned ${response.status}`);
  }

  if (response.headers.get(HttpHeader.UiMessageStream) !== 'v1') {
    throw new Error('Native trace did not use the AI SDK UI stream protocol');
  }

  const parsed = parseJsonEventStream({ stream: response.body, schema: uiMessageChunkSchema });
  const chunks: Array<UIMessageChunk> = [];

  for await (const next of parsed) {
    if (!next.success) {
      throw new Error('Native trace emitted an invalid AI SDK UI chunk');
    }

    chunks.push(next.value);
  }

  return chunks;
}
