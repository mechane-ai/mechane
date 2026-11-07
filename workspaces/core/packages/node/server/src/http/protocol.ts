import { Access, catalog, KeyMissing, RequestInvalid, RouteNotFound } from '@mechane/protocol';
import type { Operation } from '@mechane/protocol';
import { HttpHeader, HttpMethod, RecordId } from '@mechane/records';
import type { AuthCaller } from '@mechane/runtime';
import { Record, Schema } from 'effect';
import { readJsonBody } from './body.ts';
import { respondFailure } from './failure.ts';
import { findRoute } from './route.ts';
import type { ProtocolHandlerOptions, RouteMatch } from './types.ts';

type DecodeInput = {
  readonly request: Request;
  readonly url: URL;
  readonly route: RouteMatch;
  readonly operation: Operation;
};

async function decodeInput({ request, url, route, operation }: DecodeInput): Promise<object> {
  const rawBody = await readOperationBody(request);

  try {
    const params = Schema.decodeUnknownSync(operation.params, { onExcessProperty: 'error' })(route.params);

    const query = Schema.decodeUnknownSync(operation.query, { onExcessProperty: 'error' })(
      Record.fromEntries(url.searchParams),
    );

    const body = Schema.decodeUnknownSync(operation.body, { onExcessProperty: 'error' })(rawBody);

    return { ...params, ...query, ...body };
  } catch {
    throw new RequestInvalid({ reason: 'request fields do not match the operation schema' });
  }
}

async function readOperationBody(request: Request): Promise<unknown> {
  if (request.method === HttpMethod.Get) {
    return {};
  }

  return await readJsonBody(request);
}

type OperationCallerInput = {
  readonly operation: Operation;
  readonly authenticate: ProtocolHandlerOptions['authenticate'];
  readonly request: Request;
  readonly peerAddress: string | null;
};

async function operationCaller({
  operation,
  authenticate,
  request,
  peerAddress,
}: OperationCallerInput): Promise<AuthCaller> {
  if (operation.access === Access.Public) {
    return { authKind: 'public', principalId: null, keyId: null };
  }

  return await authenticate(request, peerAddress);
}

function decodeWorkspaceId(value: unknown): RecordId {
  try {
    return Schema.decodeUnknownSync(RecordId)(value);
  } catch {
    throw new RequestInvalid({ reason: 'The workspace identifier is invalid' });
  }
}

export function createProtocolHandler({
  execute,
  authenticate,
  authorizeMembership,
  limitPublicRequest,
}: ProtocolHandlerOptions) {
  return async function handleProtocol(request: Request, peerAddress: string | null = null): Promise<Response | null> {
    try {
      const url = new URL(request.url);
      const route = findRoute({ method: request.method, pathname: url.pathname });

      if (route === null) {
        if (url.pathname.startsWith('/api/')) {
          throw new RouteNotFound({ method: request.method, path: url.pathname });
        }

        return null;
      }

      const operation = catalog[route.name];

      if (operation.access === Access.Public && route.name !== 'health') {
        await limitPublicRequest(route.name, peerAddress);
      }

      const caller = await operationCaller({ operation, authenticate, request, peerAddress });

      if (operation.access === Access.Member) {
        if (caller.principalId === null) {
          throw new KeyMissing({});
        }

        const workspaceId = decodeWorkspaceId(route.params['workspace_id']);

        await authorizeMembership({ caller, workspaceId });
      }

      const input = await decodeInput({ request, url, route, operation });
      const output = await execute({ name: route.name, input, caller });
      const decoded = Schema.decodeUnknownSync(operation.output)(output);
      const body = Schema.encodeSync(operation.output)(decoded);

      return Response.json(body, { headers: { [HttpHeader.CacheControl]: 'no-store' } });
    } catch (failure) {
      return respondFailure({ failure, request });
    }
  };
}
