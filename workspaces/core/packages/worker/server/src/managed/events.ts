import { HttpHeader, HttpStatusCode } from '@mechane/records';
import {
  ManagedEventPageInput,
  ManagedSessionSend,
  ManagedStreamRequest,
  ManagedThreadPageInput,
} from '@mechane/runtime';
import { Schema } from 'effect';
import { ManagedHttpError } from './http-error.ts';
import { managedPageQuery } from './page-query.ts';
import { getSessionRuntime } from './session-runtime.ts';
import type { ManagedRequest } from './types.ts';

type ActorPage = { readonly data: ReadonlyArray<unknown>; readonly has_more: boolean; readonly last_id: string | null };

function publicPage(page: ActorPage) {
  if (page.has_more) {
    return { data: page.data, next_page: page.last_id };
  }

  return { data: page.data, next_page: null };
}

function eventInput<T>(schema: Schema.Codec<T, unknown>, value: unknown, message: string): T {
  try {
    return Schema.decodeUnknownSync(schema)(value);
  } catch {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, message);
  }
}

function pathIdentifier(params: ManagedRequest['params'], key: string): string {
  const id = params[key];

  if (id === undefined || id.length === 0) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, `Missing ${key}`);
  }

  return id;
}

function lastEventIdHeader(request: Request): string | undefined {
  const value = request.headers.get(HttpHeader.LastEventId)?.trim();

  if (value === undefined || value.length === 0) {
    return undefined;
  }

  return value;
}

export async function handleEvents(input: ManagedRequest): Promise<unknown> {
  const { operation, params, query } = input;
  const sessionId = pathIdentifier(params, 'session_id');
  const runtime = await getSessionRuntime(input, sessionId);
  const { page: afterId, maxRows: limit, ...filters } = managedPageQuery(query);
  const workerLeaseId = input.workerSession?.leaseId;

  switch (operation) {
    case 'BetaSendEvents': {
      const batch = eventInput(
        ManagedSessionSend,
        { sessionId, workerLeaseId, events: input.body['events'] },
        'Invalid event batch',
      );

      const accepted = await runtime.send(batch);

      return { data: accepted };
    }
    case 'BetaListEvents':
    case 'BetaListSessionThreadEvents': {
      const target = {
        sessionId,
        workerLeaseId,
        threadId: params['thread_id'],
        afterId,
        limit,
        ...filters,
        order: query['order'],
        types: query['types[]'],
      };

      const list = eventInput(ManagedEventPageInput, target, 'Invalid event list parameters');
      const page = await runtime.events(list);

      return publicPage(page);
    }
    case 'BetaStreamSessionEvents':
    case 'BetaStreamSessionThreadEvents': {
      if (workerLeaseId !== undefined && query['event_deltas[]'] !== undefined) {
        throw new ManagedHttpError(HttpStatusCode.Forbidden, 'Worker credentials cannot stream model previews');
      }

      const target = {
        sessionId,
        workerLeaseId,
        threadId: params['thread_id'],
        lastEventId: lastEventIdHeader(input.request),
        eventDeltas: query['event_deltas[]'],
      };

      const stream = eventInput(ManagedStreamRequest, target, 'Invalid event stream parameters');

      return await runtime.stream({ ...stream, signal: input.request.signal });
    }
    case 'BetaListSessionThreads': {
      const target = { sessionId, afterId, limit, ...filters, statuses: query['statuses[]'] };
      const list = eventInput(ManagedThreadPageInput, target, 'Invalid thread list parameters');
      const page = await runtime.threads(list);

      return publicPage(page);
    }
    case 'BetaGetSessionThread': {
      const threadId = pathIdentifier(params, 'thread_id');

      return await runtime.thread({ sessionId, threadId });
    }
    case 'BetaArchiveSessionThread': {
      const threadId = pathIdentifier(params, 'thread_id');

      return await runtime.archiveThread({ sessionId, threadId });
    }
    default:
      throw new ManagedHttpError(HttpStatusCode.NotFound, 'Unknown event or thread operation');
  }
}
