import type { HttpBindings } from '@hono/node-server';
import { catalog, RELEASE, RequestInvalid, SERVICE, ServiceUnavailable } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode, RecordId, SlackConnectionId } from '@mechane/records';
import { Schema } from 'effect';
import { Hono } from 'hono';
import { clientAddress } from './http/client-address.ts';
import { respondFailure } from './http/failure.ts';

export type RequestHandler = (request: Request, peerAddress?: string | null) => Promise<Response | null>;
type SlackRequest = { readonly request: Request; readonly workspaceId: string; readonly connectionId: string };
type ServerEnvironment = { readonly Bindings: HttpBindings };

type ApplicationInput = {
  readonly handlers: ReadonlyArray<RequestHandler>;
  readonly slack: (input: SlackRequest) => Promise<Response>;
  readonly checkHealth: () => Promise<void>;
  readonly isReady: () => boolean;
  readonly isTrustedProxy?: boolean;
};

function unavailable(request: Request): Response {
  return respondFailure({ failure: new ServiceUnavailable({ reason: 'The server is not ready' }), request });
}

export function createApplication({
  handlers,
  slack,
  checkHealth,
  isReady,
  isTrustedProxy = false,
}: ApplicationInput): Hono<ServerEnvironment> {
  const application = new Hono<ServerEnvironment>();

  application.get(catalog.health.path, () => Response.json({ service: SERVICE, release: RELEASE }));
  application.get('/ready', async (context) => {
    if (!isReady()) {
      return unavailable(context.req.raw);
    }

    try {
      await checkHealth();

      return Response.json({ ready: true }, { headers: { [HttpHeader.CacheControl]: 'no-store' } });
    } catch {
      return unavailable(context.req.raw);
    }
  });

  application.use('*', async (context, next) => {
    if (!isReady()) {
      return unavailable(context.req.raw);
    }

    return await next();
  });

  application.post('/integrations/slack/:workspaceId/:connectionId/events', async (context) => {
    const workspaceId = context.req.param('workspaceId');
    const connectionId = context.req.param('connectionId');

    if (!Schema.is(RecordId)(workspaceId) || !Schema.is(SlackConnectionId)(connectionId)) {
      const failure = new RequestInvalid({ reason: 'The Slack connection identifier is invalid' });

      return respondFailure({ failure, request: context.req.raw });
    }

    return await slack({ request: context.req.raw, workspaceId, connectionId });
  });

  application.get(
    '/',
    () =>
      new Response(null, {
        status: HttpStatusCode.Found,
        headers: { [HttpHeader.Location]: '/console/', [HttpHeader.CacheControl]: 'no-store' },
      }),
  );

  application.all('*', async (context) => {
    const request = context.req.raw;

    const peerAddress = clientAddress({
      request,
      peerAddress: context.env.incoming.socket.remoteAddress ?? null,
      isTrustedProxy,
    });

    for (const handleRequest of handlers) {
      const response = await handleRequest(request, peerAddress);

      if (response !== null) {
        return response;
      }
    }

    return new Response('Not found', { status: HttpStatusCode.NotFound });
  });

  application.onError((failure, context) => respondFailure({ failure, request: context.req.raw }));

  return application;
}
