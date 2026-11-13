import { catalog } from '@mechane/protocol';
import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

type ProxyState = { readonly isDropped: boolean; readonly failure: string | null };
type ProxyInput = { readonly origin: URL; readonly workspaceId: string };
type Proxy = { readonly origin: URL; readonly state: ProxyState; readonly stop: () => Promise<void> };

type ForwardInput = {
  readonly origin: URL;
  readonly creationPath: string;
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly getState: () => ProxyState;
  readonly markDropped: () => void;
};

async function forward({
  origin,
  creationPath,
  request,
  response,
  getState,
  markDropped,
}: ForwardInput): Promise<void> {
  const chunks: Array<Uint8Array> = [];
  const stream: AsyncIterable<Uint8Array> = request;

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  const headers = new Headers();

  for (const name of [HttpHeader.Authorization, HttpHeader.ContentType, HttpHeader.Accept]) {
    const value = request.headers[name];

    if (typeof value === 'string') {
      headers.set(name, value);
    }
  }

  const method = request.method ?? HttpMethod.Get;
  const body = Buffer.concat(chunks);
  const options: RequestInit = { method, headers };

  if (body.length > 0) {
    options.body = body;
  }

  const target = new URL(request.url ?? '/', origin);
  const upstream = await fetch(target, options);
  const bytes = await upstream.arrayBuffer();

  if (!getState().isDropped && method === HttpMethod.Post && target.pathname === creationPath) {
    if (!upstream.ok) {
      throw new Error(`The upstream creation failed with status ${upstream.status}`);
    }

    markDropped();

    response.destroy();

    return;
  }

  response.writeHead(upstream.status, {
    [HttpHeader.ContentType]: upstream.headers.get(HttpHeader.ContentType) ?? MediaType.Json,
  });
  response.end(Buffer.from(bytes));
}

export async function creationResponseProxy({ origin, workspaceId }: ProxyInput): Promise<Proxy> {
  let state: ProxyState = { isDropped: false, failure: null };
  const creationPath = catalog.createMech.path.replace(':workspace_id', workspaceId);

  const server = createServer((request, response) => {
    void forward({
      origin,
      creationPath,
      request,
      response,
      getState: () => state,
      markDropped: () => {
        state = { ...state, isDropped: true };
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
