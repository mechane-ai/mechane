import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { Schema } from 'effect';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]']);

const CreatedAgent = Schema.fromJsonString(
  Schema.Struct({ id: Schema.NonEmptyString, metadata: Schema.Struct({ eval_creation_id: Schema.NonEmptyString }) }),
);

type CreatedAgent = typeof CreatedAgent.Type;
type ProxyState = { readonly droppedAgent: CreatedAgent | null; readonly failure: string | null };
type ProxyInput = { readonly origin: URL };
type Proxy = { readonly origin: URL; readonly state: ProxyState; readonly stop: () => Promise<void> };

type ForwardInput = {
  readonly origin: URL;
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly getState: () => ProxyState;
  readonly markDropped: (agent: CreatedAgent) => void;
};

async function forward({ origin, request, response, getState, markDropped }: ForwardInput): Promise<void> {
  const chunks: Array<Uint8Array> = [];
  const stream: AsyncIterable<Uint8Array> = request;

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  const headers = new Headers();

  for (const name of [
    HttpHeader.Authorization,
    HttpHeader.ContentType,
    HttpHeader.Accept,
    'x-api-key',
    'anthropic-version',
    'anthropic-beta',
    'anthropic-workspace-id',
  ]) {
    const value = request.headers[name];

    if (typeof value === 'string') {
      headers.set(name, value);
    }
  }

  const method = request.method ?? HttpMethod.Get;
  const body = Buffer.concat(chunks);
  const options: RequestInit = { method, headers, redirect: 'error' };

  if (body.length > 0) {
    options.body = body;
  }

  const target = new URL(request.url ?? '/', origin);

  if (target.origin !== origin.origin) {
    throw new Error('The eval fixture only forwards to its local stack');
  }

  const upstream = await fetch(target, options);
  const bytes = await upstream.arrayBuffer();

  if (getState().droppedAgent === null && method === HttpMethod.Post && target.pathname === '/v1/agents') {
    if (!upstream.ok) {
      throw new Error(`The upstream creation failed with status ${upstream.status}`);
    }

    markDropped(Schema.decodeUnknownSync(CreatedAgent)(new TextDecoder().decode(bytes)));

    response.destroy();

    return;
  }

  response.writeHead(upstream.status, {
    [HttpHeader.ContentType]: upstream.headers.get(HttpHeader.ContentType) ?? MediaType.Json,
  });
  response.end(Buffer.from(bytes));
}

export async function creationResponseProxy({ origin }: ProxyInput): Promise<Proxy> {
  if (origin.protocol !== 'http:' || !LOOPBACK_HOSTS.has(origin.hostname)) {
    throw new Error('The eval creation proxy requires a loopback fixture');
  }

  let state: ProxyState = { droppedAgent: null, failure: null };

  const server = createServer((request, response) => {
    void forward({
      origin,
      request,
      response,
      getState: () => state,
      markDropped: (agent) => {
        state = { ...state, droppedAgent: agent };
      },
    }).catch((error: unknown) => {
      state = { ...state, failure: String(error) };

      response.destroy();
    });
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('The creation proxy did not bind a TCP port');
  }

  const proxyOrigin = new URL(origin);

  proxyOrigin.hostname = '127.0.0.1';
  proxyOrigin.port = String(address.port);

  return {
    origin: proxyOrigin,
    get state() {
      return state;
    },
    stop: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
      });
    },
  };
}
