import { BYTES_PER_MEBIBYTE, HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import {
  installedComputerPath,
  installedComputerQuery,
  isInstalledWorkerComputerOperation,
} from '@mechane/sandbox-wire';
import type { ManagedWorkerClaim } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Duration, Option, Predicate, Result } from 'effect';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { Writable } from 'node:stream';
import { text } from 'node:stream/consumers';
import type { Exchange } from '../types.ts';

const LOCAL_HOST = 'localhost';
const LOCAL_TICKET = 'x-mechane-computer-ticket';
const COMPUTER_RESOURCES: ReadonlySet<string> = new Set(['processes', 'browser', 'evidence', 'completions']);
const RESPONSE_HEADERS = [HttpHeader.ContentType, HttpHeader.ContentRange, HttpHeader.AcceptRanges] as const;
const REQUEST_MAX_BYTES = 2 * BYTES_PER_MEBIBYTE;
const REQUEST_TIMEOUT = Duration.seconds(90);
const TICKET_BYTES = 32;

type RelayOptions = Pick<ManagedWorkerClaim, 'apiOrigin' | 'sessionId'> & {
  readonly token: string;
  readonly signal: AbortSignal;
  readonly transport: typeof fetch;
};

type Relay = { readonly socket: string; readonly ticket: string; readonly close: () => Promise<void> };
type LocalRequest = RelayOptions & Exchange & Pick<Relay, 'ticket'>;

async function forward({
  request,
  response,
  ticket,
  apiOrigin,
  sessionId,
  token,
  transport,
  signal,
}: LocalRequest): Promise<void> {
  const { method = '', url: path = '' } = request;
  const [pathname = '', search = '', extra] = path.split('?');
  const resource = pathname.slice(1);
  const query = new URLSearchParams(search);
  const cursor = installedComputerQuery({ resource, query });
  const [collection = ''] = resource.split('/');
  const allowed = isInstalledWorkerComputerOperation({ method, resource });
  const hasOrigin = Predicate.isNotUndefined(request.headers.origin);
  const isLocal = request.headers.host === LOCAL_HOST && !hasOrigin && request.headers[LOCAL_TICKET] === ticket;
  const isValidPath = path.startsWith('/') && Predicate.isUndefined(extra);
  const isComputer = isValidPath && COMPUTER_RESOURCES.has(collection) && allowed;

  if (!isLocal || !isComputer || Option.isNone(cursor)) {
    request.resume();
    response.writeHead(HttpStatusCode.NotFound).end();

    return;
  }

  // The packaged client sends fixed-length JSON. Reject chunking before reading any bytes.
  const { 'content-length': length = '0', 'transfer-encoding': encoding } = request.headers;

  if (Predicate.isNotUndefined(encoding) || Number(length) > REQUEST_MAX_BYTES) {
    request.resume();
    response.writeHead(HttpStatusCode.PayloadTooLarge).end();

    return;
  }

  const canceled = new AbortController();

  response.once('close', () => {
    if (!response.writableFinished) {
      canceled.abort();
    }
  });

  const timeoutMs = Duration.toMillis(REQUEST_TIMEOUT);
  const timeout = AbortSignal.timeout(timeoutMs);
  const deadline = AbortSignal.any([signal, canceled.signal, timeout]);
  const headers = new Headers({ [HttpHeader.Authorization]: `Bearer ${token}` });
  const route = installedComputerPath({ sessionId, resource });
  const url = new URL(route, apiOrigin);
  url.search = cursor.value;
  const options: RequestInit = { method, headers, redirect: 'error', signal: deadline };

  if (method === HttpMethod.Post && Number(length) > 0) {
    options.body = await text(request);

    headers.set(HttpHeader.ContentType, MediaType.Json);
  }

  const answer = await transport(url, options);

  for (const name of RESPONSE_HEADERS) {
    const value = answer.headers.get(name);

    if (Predicate.isNotNull(value)) {
      response.setHeader(name, value);
    }
  }

  response.writeHead(answer.status);

  if (Predicate.isNull(answer.body)) {
    response.end();

    return;
  }

  const output = Writable.toWeb(response);

  await answer.body.pipeTo(output, { signal: deadline });
}

export async function startComputerRelay({ signal, ...options }: RelayOptions): Promise<Relay> {
  signal.throwIfAborted();

  const socket = `mechane-computer-${randomBytes(TICKET_BYTES).toString('hex')}`;
  const ticket = randomBytes(TICKET_BYTES).toString('base64url');

  const inFlight = new Map<Exchange['response'], Promise<void>>();

  async function respond({ request, response }: Exchange): Promise<void> {
    const promise = forward({ ...options, signal, request, response, ticket });
    const result = await capturePromise({ promise });

    if (Result.isFailure(result)) {
      if (response.headersSent) {
        response.destroy();
      } else {
        response.writeHead(HttpStatusCode.BadGateway).end();
      }
    }

    inFlight.delete(response);
  }

  const server = createServer((request, response) => {
    const pending = respond({ request, response });

    inFlight.set(response, pending);
  });

  const closed = Promise.withResolvers<void>();

  server.once('close', closed.resolve);

  function stop(): void {
    if (server.listening) {
      server.close();
    }

    server.closeAllConnections();
  }

  signal.addEventListener('abort', stop, { once: true });

  const listening = once(server, 'listening', { signal });
  // Linux drops an abstract Unix socket when the worker dies, even on SIGKILL.
  server.requestTimeout = Duration.toMillis(REQUEST_TIMEOUT);

  server.listen({ path: `\0${socket}`, signal });
  await listening;

  async function close(): Promise<void> {
    signal.removeEventListener('abort', stop);
    stop();
    await closed.promise;

    const requests = inFlight.values();

    await Promise.all(requests);
  }

  return { socket, ticket, close };
}
