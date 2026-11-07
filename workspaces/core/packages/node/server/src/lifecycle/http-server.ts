import { getRequestListener } from '@hono/node-server';
import { HttpStatusCode } from '@mechane/records';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { createApplication } from '../application.ts';
import type { ServerSettings } from '../settings/server.ts';

const REQUEST_TIMEOUT_MS = 30_000;
const HEADERS_TIMEOUT_MS = 15_000;

type HttpServerInput = {
  readonly application: ReturnType<typeof createApplication>;
  readonly settings: ServerSettings;
};

export async function listen({ application, settings }: HttpServerInput): Promise<Server> {
  const listener = getRequestListener(application.fetch, {
    errorHandler: () => new Response('Invalid HTTP request', { status: HttpStatusCode.BadRequest }),
  });

  const server = createServer(
    { requestTimeout: REQUEST_TIMEOUT_MS, headersTimeout: HEADERS_TIMEOUT_MS },
    (request, response) => {
      void listener(request, response);
    },
  );

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(settings.port, settings.host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  return server;
}
