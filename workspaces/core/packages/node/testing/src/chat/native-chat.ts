import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { parseJsonEventStream, readUIMessageStream, uiMessageChunkSchema, validateUIMessages } from 'ai';
import type { UIMessage, UIMessageChunk } from 'ai';
import { randomUUID } from 'node:crypto';
import type { MechContext } from '../types.ts';

type ChatIdentity = { readonly origin: URL; readonly token: string };

type ChatInput = MechContext & { readonly sessionId?: string; readonly messageId?: string; readonly text: string };

type StartedChat = { readonly workflowRunId: string; readonly response: Response };

type ReplayInput = {
  readonly origin: URL;
  readonly token?: string;
  readonly workflowRunId: string;
  readonly startIndex?: number;
};

type ConversationInput = ChatIdentity & {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly sessionId?: string;
};

type ReadChat = { readonly chunks: ReadonlyArray<UIMessageChunk>; readonly message: UIMessage };

const CHAT_DEADLINE_MS = 120_000;

export async function startNativeChat(input: ChatInput): Promise<StartedChat> {
  const { stack, account, mechId, sessionId } = input;

  const message: UIMessage = {
    id: input.messageId ?? randomUUID(),
    role: 'user',
    parts: [{ type: 'text', text: input.text }],
  };

  const response = await fetch(new URL('/api/chat', stack.origin), {
    method: HttpMethod.Post,
    headers: { [HttpHeader.Authorization]: `Bearer ${account.token}`, [HttpHeader.ContentType]: MediaType.Json },
    body: JSON.stringify({ workspaceId: account.workspaceId, mechId, sessionId, message }),
    signal: AbortSignal.timeout(CHAT_DEADLINE_MS),
  });

  if (!response.ok) {
    throw new Error(`Native chat admission returned ${response.status}`);
  }

  const workflowRunId = response.headers.get(HttpHeader.WorkflowRunId);

  if (workflowRunId === null) {
    throw new Error('Native chat admission omitted its workflow run identity');
  }

  return { workflowRunId, response };
}

export async function replayNativeChat(input: ReplayInput): Promise<Response> {
  const url = new URL(chatStreamPath(input), input.origin);
  const headers = new Headers();

  if (input.token !== undefined) {
    headers.set(HttpHeader.Authorization, `Bearer ${input.token}`);
  }

  if (input.startIndex !== undefined) {
    url.searchParams.set('startIndex', String(input.startIndex));
  }

  return await fetch(url, { headers, signal: AbortSignal.timeout(CHAT_DEADLINE_MS) });
}

export async function readNativeConversation(input: ConversationInput): Promise<ReadonlyArray<UIMessage>> {
  const url = new URL('/api/chat', input.origin);

  url.searchParams.set('workspaceId', input.workspaceId);
  url.searchParams.set('mechId', input.mechId);

  if (input.sessionId !== undefined) {
    url.searchParams.set('sessionId', input.sessionId);
  }

  const response = await fetch(url, {
    headers: { [HttpHeader.Authorization]: `Bearer ${input.token}` },
    signal: AbortSignal.timeout(CHAT_DEADLINE_MS),
  });

  if (!response.ok) {
    throw new Error(`Native conversation returned ${response.status}`);
  }

  const body: unknown = await response.json();

  if (typeof body !== 'object' || body === null) {
    throw new Error('Native conversation omitted its message history');
  }

  if (!('messages' in body) || !Array.isArray(body.messages)) {
    throw new Error('Native conversation omitted its message history');
  }

  return await validateUIMessages({ messages: body.messages });
}

export async function readNativeChunks(response: Response): Promise<ReadonlyArray<UIMessageChunk>> {
  if (!response.ok || response.body === null) {
    throw new Error(`Native chat stream returned ${response.status}`);
  }

  if (response.headers.get(HttpHeader.UiMessageStream) !== 'v1') {
    throw new Error('Native chat did not use the AI SDK UI stream protocol');
  }

  const parsed = parseJsonEventStream({ stream: response.body, schema: uiMessageChunkSchema });
  const chunks: Array<UIMessageChunk> = [];

  for await (const next of parsed) {
    if (!next.success) {
      throw new Error('Native chat emitted an invalid AI SDK UI chunk');
    }

    chunks.push(next.value);
  }

  return chunks;
}

function chatStreamPath({ workflowRunId }: Pick<ReplayInput, 'workflowRunId'>): string {
  return `/api/chat/${encodeURIComponent(workflowRunId)}/stream`;
}

export async function readNativeChat(response: Response): Promise<ReadChat> {
  const chunks = await readNativeChunks(response);
  const messages: Array<UIMessage> = [];
  const stream = ReadableStream.from(chunks);

  for await (const message of readUIMessageStream({ stream, terminateOnError: true })) {
    messages.push(message);
  }

  const message = messages.at(-1);

  if (message === undefined) {
    throw new Error('Native chat completed without a message');
  }

  return { chunks, message };
}

export function nativeChatText(message: UIMessage): string {
  const parts: Array<string> = [];

  for (const part of message.parts) {
    if (part.type === 'text') {
      parts.push(part.text);
    }
  }

  return parts.join('');
}
