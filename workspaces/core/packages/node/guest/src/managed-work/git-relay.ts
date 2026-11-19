import type { BetaManagedAgentsGitHubRepositoryResource } from '@anthropic-ai/sdk/resources/beta/sessions/resources';
import type { BetaManagedAgentsSession } from '@anthropic-ai/sdk/resources/beta/sessions/sessions';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { Predicate, Schema } from 'effect';
import { once } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import type { IncomingMessage, OutgoingHttpHeaders } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { Exchange } from '../types.ts';

const LOOPBACK = '127.0.0.1';
const HTTPS = 'https:';
const BoundAddress = Schema.Struct({ port: Schema.Int });
const RESPONSE_HEADERS = [HttpHeader.ContentType, HttpHeader.ContentLength, 'content-encoding'] as const;
const REQUEST_HEADERS = [...RESPONSE_HEADERS, 'git-protocol'] as const;

const ENDPOINTS = [
  [HttpMethod.Get, 'info/refs?service=git-upload-pack'],
  [HttpMethod.Get, 'info/refs?service=git-receive-pack'],
  [HttpMethod.Post, 'git-upload-pack'],
  [HttpMethod.Post, 'git-receive-pack'],
] as const;

type ResourceRoute = {
  readonly sessionId: BetaManagedAgentsSession['id'];
  readonly resourceId: BetaManagedAgentsGitHubRepositoryResource['id'];
};

type RelayInput = Pick<ResourceRoute, 'sessionId'> & {
  readonly origin: string;
  readonly resourceIds: ReadonlyArray<ResourceRoute['resourceId']>;
  readonly token: string;
  readonly signal: AbortSignal;
};

type Relay = { readonly origin: string; readonly close: () => Promise<void> };
type Destination = { readonly url: URL; readonly method: HttpMethod };
type Reply = Pick<Exchange, 'response'> & { readonly incoming: IncomingMessage };
type Forward = Exchange & Pick<RelayInput, 'token' | 'signal'> & { readonly destination: Destination };
type Finish = Pick<Exchange, 'response'> & { readonly status: number };

export function gitMountRoute({ sessionId, resourceId }: ResourceRoute): string {
  return ['', 'git', encodeURIComponent(sessionId), encodeURIComponent(resourceId)].join('/');
}

function destinations({
  origin,
  sessionId,
  resourceIds,
}: Pick<RelayInput, 'origin' | 'sessionId' | 'resourceIds'>): ReadonlyMap<string, Destination> {
  const entries = resourceIds.flatMap((resourceId) => {
    const path = gitMountRoute({ sessionId, resourceId });

    return ENDPOINTS.map(([method, suffix]) => {
      const route = [path, suffix].join('/');
      const upstreamPath = ['/__mechane', route].join('');
      const upstream = new URL(upstreamPath, origin);

      return [route, { url: upstream, method }] as const;
    });
  });

  return new Map(entries);
}

function finish({ response, status }: Finish): void {
  if (!response.headersSent) {
    response.writeHead(status, { [HttpHeader.CacheControl]: 'no-store' });
  }

  response.end();
}

function reply({ incoming, response }: Reply): void {
  const { statusCode: status = HttpStatusCode.BadGateway } = incoming;

  if (status !== HttpStatusCode.Ok) {
    incoming.resume();
    finish({ response, status });

    return;
  }

  for (const name of RESPONSE_HEADERS) {
    const value = incoming.headers[name];

    if (typeof value === 'string') {
      response.setHeader(name, value);
    }
  }

  incoming.on('error', () => response.destroy());
  incoming.pipe(response);
}

function requestClient({ protocol }: URL): typeof httpRequest {
  if (protocol === HTTPS) {
    return httpsRequest;
  }

  return httpRequest;
}

function forward({ request, response, destination, token, signal }: Forward): void {
  const headers: OutgoingHttpHeaders = { [HttpHeader.Authorization]: `Bearer ${token}` };

  for (const name of REQUEST_HEADERS) {
    const value = request.headers[name];

    if (typeof value === 'string') {
      headers[name] = value;
    }
  }

  const options = { method: destination.method, headers, signal };
  const client = requestClient(destination.url);
  const upstream = client(destination.url, options, (incoming) => reply({ incoming, response }));

  response.once('close', () => {
    if (!response.writableFinished) {
      upstream.destroy();
    }
  });
  request.once('error', () => upstream.destroy());
  upstream.once('error', () => finish({ response, status: HttpStatusCode.BadGateway }));
  request.pipe(upstream);
}

/** Git sees only the session's loopback origin. The work token stays in the relay process. */
export async function startGitRelay({ origin, sessionId, resourceIds, token, signal }: RelayInput): Promise<Relay> {
  signal.throwIfAborted();

  const targets = destinations({ origin, sessionId, resourceIds });
  const server = createServer();
  const listening = once(server, 'listening');

  server.listen(0, LOOPBACK);
  await listening;

  const address = server.address();
  const { port } = await Schema.decodeUnknownPromise(BoundAddress)(address);
  const local = new URL('http://127.0.0.1');
  local.port = String(port);

  server.on('request', (request, response) => {
    const { url = '' } = request;
    const target = targets.get(url);

    const allowedOrigin = request.headers.host === local.host && Predicate.isUndefined(request.headers.origin);

    if (!allowedOrigin || Predicate.isUndefined(target) || target.method !== request.method) {
      request.resume();
      finish({ response, status: HttpStatusCode.NotFound });

      return;
    }

    forward({ request, response, destination: target, token, signal });
  });

  const closed = once(server, 'close');

  function abort(): void {
    if (server.listening) {
      server.close();
      server.closeAllConnections();
    }
  }

  async function close(): Promise<void> {
    signal.removeEventListener('abort', abort);
    abort();
    await closed;
  }

  signal.addEventListener('abort', abort, { once: true });

  if (signal.aborted) {
    await close();
    signal.throwIfAborted();
  }

  return { origin: local.origin, close };
}
