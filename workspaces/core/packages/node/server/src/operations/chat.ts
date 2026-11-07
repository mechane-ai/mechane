import { RequestInvalid, RouteNotFound, slackChannelUrl } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, RecordId, SlackChannelId, SlackTeamId } from '@mechane/records';
import { requireAuthenticated, requireWorkspaceMember, StoreConflict } from '@mechane/runtime';
import type { AuthCaller, InputOrigin, RuntimeStore, StartAdmission } from '@mechane/runtime';
import { validateUIMessages } from 'ai';
import type { UIMessage } from 'ai';
import { Record, Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import { readJsonBody } from '../http/body.ts';
import { respondFailure } from '../http/failure.ts';

const HISTORY_MAX_MESSAGES = 100;
const INPUT_TEXT_MAX_LENGTH = 65_536;
const MESSAGE_ID_MAX_LENGTH = 256;
const STREAM_CURSOR_MAX_CHUNKS = 1_000_000;

const StreamQuery = Schema.Struct({
  startIndex: Schema.optionalKey(
    Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: STREAM_CURSOR_MAX_CHUNKS })),
  ),
});

const ChatQuery = Schema.Struct({
  workspaceId: RecordId,
  mechId: RecordId,
  sessionId: Schema.optionalKey(RecordId),
  before: Schema.optionalKey(RecordId),
});

const ChatInput = Schema.Struct({
  workspaceId: RecordId,
  mechId: RecordId,
  sessionId: Schema.optionalKey(RecordId),
  message: Schema.Unknown,
});

type Authenticate = (request: Request, peerAddress?: string | null) => Promise<AuthCaller>;

type ReadRunStream = (input: {
  readonly workspaceId: string;
  readonly runId: string;
  readonly cursor?: number;
}) => Promise<Response>;

type ChatHandlerOptions = {
  readonly store: RuntimeStore;
  readonly authenticate: Authenticate;
  readonly startAdmission: StartAdmission;
  readonly readRunUIStream: ReadRunStream;
};

type ConsoleSessionInput = {
  readonly store: RuntimeStore;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly sessionId?: string;
};

async function consoleSessionId({ store, workspaceId, mechId, sessionId }: ConsoleSessionInput): Promise<string> {
  if (sessionId !== undefined) {
    return sessionId;
  }

  const session = await store.ensureSession({ workspaceId, mechId, key: 'console', source: 'console' });

  return session.id;
}

function conversationSourceUrl(origin: InputOrigin | null): string | null {
  if (origin?.kind !== 'slack') {
    return null;
  }

  const teamId = Schema.decodeUnknownSync(SlackTeamId)(origin.teamId);
  const channelId = Schema.decodeUnknownSync(SlackChannelId)(origin.channelId);

  return slackChannelUrl({ teamId, channelId });
}

function requestFields<Value, Encoded>(schema: Schema.Codec<Value, Encoded>, value: unknown): Value {
  try {
    return Schema.decodeUnknownSync(schema, { onExcessProperty: 'error' })(value);
  } catch {
    throw new RequestInvalid({ reason: 'The conversation request fields are invalid' });
  }
}

function streamWorkflowId(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch {
    throw new RequestInvalid({ reason: 'The run stream path is invalid' });
  }
}

async function readConversationMessages(messages: ReadonlyArray<unknown>): Promise<ReadonlyArray<UIMessage>> {
  if (messages.length === 0) {
    return [];
  }

  return await validateUIMessages({ messages });
}

async function readUserMessage(value: unknown): Promise<UIMessage> {
  const messages = await validateUIMessages({ messages: [value] }).catch(() => {
    throw new RequestInvalid({ reason: 'The message does not match the AI SDK UI message format' });
  });

  const message = messages[0];
  const isUserMessage = message !== undefined && message.role === 'user';

  if (!isUserMessage || message.id.length === 0 || message.id.length > MESSAGE_ID_MAX_LENGTH) {
    throw new RequestInvalid({ reason: 'Send one user message with a stable identifier' });
  }

  if (message.parts.length === 0 || message.parts.some((part) => part.type !== 'text')) {
    throw new RequestInvalid({ reason: 'The conversation composer accepts text messages' });
  }

  const parts = message.parts.filter((part) => part.type === 'text');
  const text = parts.map((part) => part.text).join('\n');

  if (text.trim().length === 0 || text.length > INPUT_TEXT_MAX_LENGTH) {
    throw new RequestInvalid({ reason: 'The message must contain bounded, nonempty text' });
  }

  return { id: message.id, role: 'user', parts };
}

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

export function createChatHandler({ store, authenticate, startAdmission, readRunUIStream }: ChatHandlerOptions) {
  return async function handleChat(request: Request, peerAddress: string | null = null): Promise<Response | null> {
    const url = new URL(request.url);
    const streamPath = /^\/api\/chat\/([^/]+)\/stream$/u.exec(url.pathname);

    if (url.pathname !== '/api/chat' && streamPath === null) {
      return null;
    }

    try {
      const caller = await authenticate(request, peerAddress);
      const authenticated = requireAuthenticated(caller);

      if (streamPath !== null) {
        if (request.method !== HttpMethod.Get) {
          return new Response(null, { status: HttpStatusCode.MethodNotAllowed, headers: { allow: HttpMethod.Get } });
        }

        const encodedWorkflowId = streamPath[1];

        if (encodedWorkflowId === undefined) {
          throw new RequestInvalid({ reason: 'The run stream path is invalid' });
        }

        const workflowId = streamWorkflowId(encodedWorkflowId);
        const run = await store.getRunByWorkflowId({ workflowId });

        if (run === null) {
          throw new RouteNotFound({ method: request.method, path: url.pathname });
        }

        await requireWorkspaceMember({ store, caller, workspaceId: run.workspaceId });

        const query = requestFields(StreamQuery, Record.fromEntries(url.searchParams));

        return await readRunUIStream({ workspaceId: run.workspaceId, runId: run.id, cursor: query.startIndex ?? 0 });
      }

      if (request.method === HttpMethod.Get) {
        const input = requestFields(ChatQuery, Record.fromEntries(url.searchParams));

        await requireWorkspaceMember({ store, caller, workspaceId: input.workspaceId });
        await store.getMech({ workspaceId: input.workspaceId, mechId: input.mechId });

        const recentSessionId = input.sessionId ?? (await store.getRecentSession(input));

        const consoleSession = await store.ensureSession({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          key: 'console',
          source: 'console',
        });

        const sessionId = recentSessionId ?? consoleSession.id;

        const page = await store.listSessionMessages({
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          sessionId,
          before: input.before ?? null,
          maxRows: HISTORY_MAX_MESSAGES,
        });

        const messages = await readConversationMessages(page.messages);
        const sourceUrl = conversationSourceUrl(page.session.sourceOrigin);

        return Response.json(
          {
            sessionId,
            source: page.session.source,
            title: page.session.title,
            sourceUrl,
            consoleSessionId: consoleSession.id,
            messages,
            activeRunId: page.session.activeRunId,
            activeWorkflowId: page.session.activeWorkflowId,
            hasMore: page.hasMore,
            before: page.before,
          },
          { headers: { [HttpHeader.CacheControl]: 'no-store' } },
        );
      }

      if (request.method !== HttpMethod.Post) {
        return new Response(null, { status: HttpStatusCode.MethodNotAllowed, headers: { allow: 'GET, POST' } });
      }

      const raw = await readJsonBody(request);
      const input = requestFields(ChatInput, raw);

      await requireWorkspaceMember({ store, caller, workspaceId: input.workspaceId });
      await store.getMech({ workspaceId: input.workspaceId, mechId: input.mechId });

      const message = await readUserMessage(input.message);
      const sessionId = await consoleSessionId({ store, ...input });

      const sessionDetails = await store.getSessionSummary({
        workspaceId: input.workspaceId,
        mechId: input.mechId,
        sessionId,
      });

      if (sessionDetails.source !== 'console') {
        throw new RequestInvalid({
          reason: 'Send messages from this conversation’s original channel, or open its console conversation',
        });
      }

      const admission = await store
        .admitInput({
          id: randomUUID(),
          runId: randomUUID(),
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          sessionId,
          idempotencyKey: `console:${message.id}`,
          inputText: messageText(message),
          inputMessage: message,
          origin: { kind: 'console', principalId: authenticated.principalId },
        })
        .catch((error: unknown) => {
          if (error instanceof StoreConflict) {
            throw new RequestInvalid({
              reason: 'The message identifier already names a different message or conversation',
            });
          }

          throw error;
        });

      const started = await startAdmission({ runId: admission.run.id });
      const stream = await readRunUIStream({ workspaceId: input.workspaceId, runId: admission.run.id });
      const headers = new Headers(stream.headers);

      headers.set(HttpHeader.WorkflowRunId, started.workflowId);
      headers.set(HttpHeader.MechaneRunId, admission.run.id);
      headers.set(HttpHeader.MechaneSessionId, sessionId);
      headers.set(HttpHeader.CacheControl, 'no-store');

      return new Response(stream.body, { status: stream.status, headers });
    } catch (failure) {
      return respondFailure({ failure, request });
    }
  };
}
