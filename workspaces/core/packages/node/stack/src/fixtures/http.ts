import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { Record, Schema } from 'effect';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { closeHttpServer } from '../http/close-http-server.ts';

const REQUEST_MAX_BYTES = 2_097_152;
const BODYLESS_METHODS: ReadonlySet<string> = new Set([HttpMethod.Get, HttpMethod.Head]);

export type HttpService = { readonly origin: URL; readonly close: () => Promise<void> };
export type HttpHandler = (request: Request) => Promise<Response>;

export const record = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown));

export function text(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('Expected text');
  }

  return value;
}

export async function startHttpService(answer: HttpHandler): Promise<HttpService> {
  const server = createServer((request, response) => {
    void handleRequest(request, response, answer).catch(() => {
      if (!response.headersSent) {
        response.writeHead(HttpStatusCode.InternalServerError, { [HttpHeader.ContentType]: MediaType.Json });
      }

      response.end('{"error":"Fixture request failed"}');
    });
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('The fixture has no loopback address');
  }

  const origin = new URL(fixtureOriginUrl({ host: `127.0.0.1:${address.port}` }));

  return { origin, close: async () => await closeHttpServer(server) };
}

async function handleRequest(incoming: IncomingMessage, outgoing: ServerResponse, answer: HttpHandler): Promise<void> {
  const chunks: Array<Uint8Array> = [];
  let sizeBytes = 0;

  for await (const value of incoming) {
    const chunk = Buffer.from(value);
    sizeBytes += chunk.byteLength;

    if (sizeBytes > REQUEST_MAX_BYTES) {
      outgoing.writeHead(HttpStatusCode.PayloadTooLarge);
      outgoing.end();

      return;
    }

    chunks.push(chunk);
  }

  const headers = new Headers();

  for (const [name, value] of Record.toEntries(incoming.headers)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        headers.set(name, value.join(', '));
      } else {
        headers.set(name, value);
      }
    }
  }

  const method = incoming.method ?? HttpMethod.Get;
  const options: RequestInit = { method, headers };

  if (!BODYLESS_METHODS.has(method)) {
    options.body = Buffer.concat(chunks);
  }

  const url = new URL(incoming.url ?? '/', fixtureOriginUrl({ host: headers.get(HttpHeader.Host) ?? '' }));
  const response = await answer(new Request(url, options));

  outgoing.writeHead(response.status, Record.fromEntries(response.headers));

  if (response.body !== null) {
    for await (const chunk of response.body) {
      if (!outgoing.write(chunk)) {
        await once(outgoing, 'drain');
      }
    }
  }

  outgoing.end();
}

function fixtureOriginUrl({ host }: { readonly host: string }): string {
  return `http://${host}`;
}
