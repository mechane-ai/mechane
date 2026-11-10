import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { Record } from 'effect';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { request } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:https';
import { handleFixtureRequest } from './fixtures/http.ts';
import type { HttpHandler } from './fixtures/http.ts';
import { closeHttpServer } from './http/close-http-server.ts';
import type { PostgresTls } from './postgres-tls.ts';
import type { GuestHttpFixture } from './types.ts';

type GatewayInput = { readonly target: URL; readonly tls: PostgresTls };
type ForwardInput = { readonly incoming: IncomingMessage; readonly outgoing: ServerResponse; readonly target: URL };

export type GuestGateway = {
  readonly origin: URL;
  readonly guestOrigin: URL;
  readonly registerFixture: (answer: HttpHandler) => GuestHttpFixture;
  readonly close: () => Promise<void>;
};

const PRIVATE_HEADERS: ReadonlySet<string> = new Set([HttpHeader.Host, HttpHeader.ProxyAuthorization, 'connection']);
const FIXTURE_PATH_PREFIX = '/__mechane_fixtures/';

export async function startGuestGateway({ target, tls }: GatewayInput): Promise<GuestGateway> {
  const key = await readFile(tls.key);
  const cert = await readFile(tls.certificate);
  const fixtures = new Map<string, HttpHandler>();

  const server = createServer({ key, cert }, (incoming, outgoing) => {
    const path = requestPath(incoming, target);

    if (path === undefined) {
      outgoing.writeHead(HttpStatusCode.BadRequest);
      outgoing.end();

      return;
    }

    const fixture = fixtures.get(path);

    if (fixture !== undefined) {
      void handleFixtureRequest(incoming, outgoing, fixture);

      return;
    }

    if (path.startsWith(FIXTURE_PATH_PREFIX)) {
      outgoing.writeHead(HttpStatusCode.NotFound);
      outgoing.end();

      return;
    }

    forward({ incoming, outgoing, target });
  });

  server.listen(0, gatewayListenHost());

  await once(server, 'listening');

  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('The guest HTTPS gateway has no loopback address');
  }

  const origin = new URL(guestGatewayUrl({ port: address.port }));
  const guestOrigin = new URL(origin.href);

  guestOrigin.hostname = 'host.docker.internal';

  return {
    origin,
    guestOrigin,
    registerFixture: (answer) => {
      const path = `${FIXTURE_PATH_PREFIX}${randomUUID()}`;

      fixtures.set(path, answer);

      return {
        url: new URL(path, guestOrigin),
        close: async () => {
          fixtures.delete(path);
        },
      };
    },
    close: async () => {
      fixtures.clear();
      await closeHttpServer(server);
    },
  };
}

function requestPath(incoming: IncomingMessage, target: URL): string | undefined {
  try {
    return new URL(incoming.url ?? '/', target).pathname;
  } catch {
    return undefined;
  }
}

function gatewayListenHost(): string {
  if (process.platform === 'linux') {
    return '0.0.0.0';
  }

  return '127.0.0.1';
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
