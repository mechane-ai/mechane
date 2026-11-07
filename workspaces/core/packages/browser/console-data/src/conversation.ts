import { HttpStatusCode } from '@mechane/records';
import { validateUIMessages } from 'ai';
import type { UIMessage } from 'ai';
import { Duration } from 'effect';
import { z } from 'zod';

const HISTORY_TIMEOUT = Duration.seconds(40);
const HISTORY_MAX_MESSAGES = 100;
const accessLostStatuses: ReadonlySet<number> = new Set([HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden]);

const HistoryEnvelope = z.object({
  sessionId: z.uuid(),
  source: z.enum(['console', 'slack', 'api']),
  title: z.string(),
  consoleSessionId: z.uuid(),
  sourceUrl: z.url().nullable(),
  messages: z.array(z.unknown()).max(HISTORY_MAX_MESSAGES),
  activeWorkflowId: z.string().nullable(),
  activeRunId: z.uuid().nullable(),
  hasMore: z.boolean(),
  before: z.string().nullable(),
});

/** Native UI messages are validated after the authorized conversation envelope is decoded. */
export type ConversationHistory = Omit<z.infer<typeof HistoryEnvelope>, 'messages'> & {
  readonly messages: Awaited<ReturnType<typeof validateUIMessages<UIMessage>>>;
};

type ConversationTarget = {
  readonly mechId: string;
  /** Absent opens the latest existing conversation. */
  readonly sessionId?: string;
  /** Absent opens the latest history page. */
  readonly before?: string;
};

type CreateConversationApi = {
  readonly origin: URL;
  readonly workspaceId: string;
  readonly signal: AbortSignal;
  readonly onAccessLost: () => void;
};

/** Native Chat uses same-origin credentials and the admitted workspace's abort lifetime. */
export function createConversationApi({ origin, workspaceId, signal, onAccessLost }: CreateConversationApi) {
  const endpoint = new URL('/api/chat', origin).href;

  const scopedFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);

    if (url.origin !== origin.origin || (url.pathname !== '/api/chat' && !url.pathname.startsWith('/api/chat/'))) {
      throw new Error('The conversation request has an invalid destination.');
    }

    const response = await fetch(request, {
      credentials: 'same-origin',
      signal: AbortSignal.any([signal, request.signal]),
    });

    if (accessLostStatuses.has(response.status)) {
      onAccessLost();
    }

    return response;
  };

  return {
    endpoint,
    signal,
    fetch: scopedFetch,
    async history(target: ConversationTarget, lifetime: AbortSignal): Promise<ConversationHistory> {
      const url = new URL(endpoint);

      url.searchParams.set('workspaceId', workspaceId);
      url.searchParams.set('mechId', target.mechId);

      if (target.sessionId !== undefined) {
        url.searchParams.set('sessionId', target.sessionId);
      }

      if (target.before !== undefined) {
        url.searchParams.set('before', target.before);
      }

      const response = await scopedFetch(url, {
        signal: AbortSignal.any([lifetime, AbortSignal.timeout(Duration.toMillis(HISTORY_TIMEOUT))]),
      });

      if (!response.ok) {
        throw new Error('The conversation could not be loaded.');
      }

      const envelope = HistoryEnvelope.parse(await response.json());
      const messages = envelope.messages.length === 0 ? [] : await validateUIMessages({ messages: envelope.messages });

      lifetime.throwIfAborted();

      return { ...envelope, messages };
    },
  };
}
