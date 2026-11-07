import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { NexusFixture, NexusRequest, NexusRequestStatus } from '../types.ts';
import { record, startHttpService, text } from './http.ts';
import type { HttpService } from './http.ts';

const DEFAULT_WAIT_MS = 30_000;
const PROVIDER_KEY_BYTES = 24;
const SIGNING_SECRET_BYTES = 32;
const REQUEST_COLLECTION_SEGMENTS = 3;
const REQUEST_DETAIL_SEGMENTS = 4;
const VENDED_TOKEN_LIFETIME_MS = 3_600_000;
export type StartedNexus = { readonly fixture: NexusFixture; readonly close: HttpService['close'] };

export async function startNexusFixture(): Promise<StartedNexus> {
  const apiKey = `fixture-nexus-${randomBytes(PROVIDER_KEY_BYTES).toString('hex')}`;
  const signingSecret = randomBytes(SIGNING_SECRET_BYTES).toString('hex');
  const serviceId = randomUUID();
  const requests = new Map<string, NexusRequest>();
  const events = new EventTarget();

  function resolve(input: { readonly id: string; readonly status: NexusRequestStatus }): NexusRequest {
    const previous = requests.get(input.id);

    if (previous === undefined) {
      throw new Error('Unknown Nexus fixture request');
    }

    const next = { ...previous, status: input.status, approval: resolvedApproval(previous.approval, input.status) };

    requests.set(input.id, next);

    return structuredClone(next);
  }

  async function waitForRequest(input?: { readonly timeoutMs?: number }): Promise<NexusRequest> {
    const first = requests.values().next().value;

    if (first !== undefined) {
      return structuredClone(first);
    }

    const signal = AbortSignal.timeout(input?.timeoutMs ?? DEFAULT_WAIT_MS);

    await once(events, 'request', { signal });

    const request = requests.values().next().value;

    if (request === undefined) {
      throw new Error('Nexus fixture did not retain its request');
    }

    return structuredClone(request);
  }

  async function handle(request: Request): Promise<Response> {
    if (request.headers.get(HttpHeader.Authorization) !== `Bearer ${apiKey}`) {
      return Response.json({ error: 'Invalid Nexus credential' }, { status: HttpStatusCode.Unauthorized });
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/access' && request.method === HttpMethod.Get) {
      return Response.json({ service: { id: serviceId } });
    }

    const parts = url.pathname.split('/').filter((part) => part.length > 0);
    const kind = requestKind(parts[2]);

    if (parts[0] !== 'api' || parts[1] !== 'requests' || kind === null) {
      return Response.json({ error: 'Unknown Nexus fixture route' }, { status: HttpStatusCode.NotFound });
    }

    if (request.method === HttpMethod.Post && parts.length === REQUEST_COLLECTION_SEGMENTS) {
      const body = record(await request.json());
      const id = text(body['id']);
      const previous = requests.get(id);

      if (previous !== undefined) {
        if (JSON.stringify(previous.body) !== JSON.stringify(body) || previous.kind !== kind) {
          return Response.json(
            { error: 'Request identity conflicts with its original payload' },
            { status: HttpStatusCode.Conflict },
          );
        }

        return Response.json(statusResponse(previous));
      }

      const approvalId = randomUUID();

      const saved: NexusRequest = {
        id,
        kind,
        status: 'pending',
        approval: { id: approvalId, url: approvalUrl({ origin: url.origin, approvalId }), status: 'pending' },
        error: null,
        body,
      };

      requests.set(id, saved);
      events.dispatchEvent(new Event('request'));

      return Response.json(statusResponse(saved));
    }

    const saved = requests.get(parts[3] ?? '');

    if (saved === undefined || saved.kind !== kind) {
      return Response.json({ error: 'Unknown Nexus fixture request' }, { status: HttpStatusCode.NotFound });
    }

    if (request.method === HttpMethod.Get && parts.length === REQUEST_DETAIL_SEGMENTS) {
      return Response.json(statusResponse(saved));
    }

    const isCollection = request.method === HttpMethod.Post && parts[4] === 'collect';

    if (isCollection && saved.kind === 'vend' && saved.status === 'ready') {
      return Response.json({
        id: saved.id,
        token: 'fixture-vended-token',
        expiresAt: new Date(Date.now() + VENDED_TOKEN_LIFETIME_MS).toISOString(),
      });
    }

    return Response.json({ error: 'Unsupported Nexus fixture operation' }, { status: HttpStatusCode.BadRequest });
  }

  const service = await startHttpService(handle);

  return {
    fixture: {
      origin: new URL('/api/requests', service.origin),
      apiKey,
      serviceId,
      signingSecret,
      readRequests: () => structuredClone([...requests.values()]),
      resolve,
      waitForRequest,
    },
    close: service.close,
  };
}

function statusResponse(request: NexusRequest): Readonly<Record<string, unknown>> {
  return {
    id: request.id,
    kind: request.kind,
    status: request.status,
    approval: request.approval,
    error: request.error,
  };
}

function resolvedApproval(approval: NexusRequest['approval'], status: NexusRequestStatus): NexusRequest['approval'] {
  if (approval === null) {
    return null;
  }

  if (status === 'ready') {
    return { ...approval, status: 'approved' };
  }

  return { ...approval, status };
}

function requestKind(value: string | undefined): NexusRequest['kind'] | null {
  if (value === undefined) {
    return null;
  }

  switch (value) {
    case 'access':
    case 'vend':
      return value;
    default:
      return null;
  }
}

function approvalUrl({ origin, approvalId }: { readonly origin: string; readonly approvalId: string }): string {
  const url = new URL('/settings/approvals', origin);

  url.searchParams.set('approval', approvalId);

  return url.href;
}
