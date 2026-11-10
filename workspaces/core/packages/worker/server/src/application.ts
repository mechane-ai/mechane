import { ServiceUnavailable } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { clientAddress } from './http/client-address.ts';
import { respondFailure } from './http/failure.ts';
import { READ_METHODS } from './http/methods.ts';

export type RequestHandler = (request: Request, peerAddress?: string | null) => Promise<Response | null>;

type ApplicationInput = {
  readonly handlers: ReadonlyArray<RequestHandler>;
  readonly checkHealth: () => Promise<void>;
  readonly isTrustedProxy?: boolean;
};

export function createApplication({ handlers, checkHealth, isTrustedProxy = false }: ApplicationInput) {
  return async function application(request: Request, peerAddress: string | null = null): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/ready' && READ_METHODS.has(request.method)) {
        try {
          await checkHealth();

          return Response.json({ ready: true }, { headers: { [HttpHeader.CacheControl]: 'no-store' } });
        } catch {
          throw new ServiceUnavailable({ reason: 'The server is not ready' });
        }
      }

      const address = clientAddress({ request, peerAddress, isTrustedProxy });

      for (const handleRequest of handlers) {
        const response = await handleRequest(request, address);

        if (response !== null) {
          return response;
        }
      }

      return new Response('Not found', { status: HttpStatusCode.NotFound });
    } catch (failure) {
      return respondFailure({ failure, request });
    }
  };
}
