import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { Record } from 'effect';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { request } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:https';
import { guestFixtureUrl } from './fixtures/guest-fixture-url.ts';
import { closeHttpServer } from './http/close-http-server.ts';
import type { PostgresTls } from './postgres-tls.ts';

type GatewayInput = { readonly target: URL; readonly tls: PostgresTls };
type ForwardInput = { readonly incoming: IncomingMessage; readonly outgoing: ServerResponse; readonly target: URL };
export type GuestGateway = { readonly origin: URL; readonly guestOrigin: URL; readonly close: () => Promise<void> };
const PRIVATE_HEADERS: ReadonlySet<string> = new Set([HttpHeader.Host, HttpHeader.ProxyAuthorization, 'connection']);

export async function startGuestGateway({ target, tls }: GatewayInput): Promise<GuestGateway> {
  const key = await readFile(tls.key);
  const cert = await readFile(tls.certificate);
  const server = createServer({ key, cert }, (incoming, outgoing) => forward({ incoming, outgoing, target }));

  server.listen(0, '127.0.0.1');

  await once(server, 'listening');

  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('The guest HTTPS gateway has no loopback address');
  }

  const origin = new URL(guestGatewayUrl({ port: address.port }));

  return { origin, guestOrigin: guestFixtureUrl(origin), close: async () => await closeHttpServer(server) };
}

function forward({ incoming, outgoing, target }: ForwardInput): void {
  const headers = Record.filter(incoming.headers, (_value, name) => !PRIVATE_HEADERS.has(name));

  const upstream = request(
    {
      hostname: target.hostname,
      port: target.port,
      method: incoming.method,
      path: incoming.url,
      headers,
      agent: false,
    },
    (response) => {
      outgoing.writeHead(response.statusCode ?? HttpStatusCode.Unavailable, response.headers);
      response.on('error', () => outgoing.destroy());
      response.pipe(outgoing);
    },
  );

  upstream.on('error', () => {
    if (outgoing.headersSent) {
      outgoing.destroy();

      return;
    }

    outgoing.writeHead(HttpStatusCode.Unavailable);
    outgoing.end();
  });
  incoming.on('aborted', () => upstream.destroy());
  incoming.on('error', () => upstream.destroy());
  outgoing.on('close', () => upstream.destroy());
  incoming.pipe(upstream);
}

function guestGatewayUrl({ port }: { readonly port: number }): string {
  return `https://127.0.0.1:${port}`;
}
