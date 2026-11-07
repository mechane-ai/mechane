import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { Redacted } from 'effect';
import { createHash } from 'node:crypto';
import { FatalError, RetryableError } from 'workflow';
import { z } from 'zod';
import type { RequestKind, RequestService, Run } from '../domain.ts';
import type { RunIdentity } from '../execution/types.ts';
import { withRuntimeStore } from '../store/runtime-store.ts';

const REQUEST_TIMEOUT_MS = 15_000;
const RESPONSE_MAX_BYTES = 32_768;
const ACTIVE_RUN_STATES: ReadonlySet<Run['status']> = new Set(['running', 'waiting']);
const ServiceAccess = z.object({ service: z.object({ id: z.string() }) });

type ServiceSelection = {
  readonly context: RunIdentity;
  readonly kind: RequestKind;
  readonly expectedIdentity?: string;
};

type RequestTransport = {
  readonly service: LoadedService;
  readonly url: URL;
  readonly method: typeof HttpMethod.Get | typeof HttpMethod.Post;
  readonly body?: unknown;
};

export type LoadedService = {
  readonly run: Run;
  readonly configuration: RequestService;
  readonly token: Redacted.Redacted;
  readonly identity: string;
};

export type NexusResponse = { readonly isSuccessful: boolean; readonly status: number; readonly payload: unknown };

export async function loadRequestService({
  context,
  kind,
  expectedIdentity,
}: ServiceSelection): Promise<LoadedService> {
  return await withRuntimeStore(async (store) => {
    const run = await store.getRun({ runId: context.runId, workspaceId: context.workspaceId });

    if (run === null || run.mechId !== context.mechId || run.sessionId !== context.sessionId) {
      throw new FatalError('The request run is unavailable.');
    }

    if (!ACTIVE_RUN_STATES.has(run.status) || run.cancelRequestedAt !== null) {
      throw new FatalError('The request run is no longer active.');
    }

    const access = await store.getExecutionAccess({ workspaceId: context.workspaceId, mechId: context.mechId });

    if (access === null || access.requestService === null) {
      throw new FatalError('No Nexus request service is configured for this mech.');
    }

    const configuration = access.requestService;
    const secrets = access.secrets;
    const reference = credentialReference();
    const token = await store.getCredential({ workspaceId: context.workspaceId, reference });

    if (token === null) {
      throw new FatalError('The Nexus request credential is unavailable.');
    }

    const identity = createHash('sha256')
      .update(
        JSON.stringify([
          configuration.url,
          configuration.serviceId,
          configuration.secretReference,
          reference,
          Redacted.value(token),
        ]),
      )
      .digest('hex');

    if (expectedIdentity !== undefined && expectedIdentity !== identity) {
      throw new FatalError('The Nexus request authority changed while this task was waiting.');
    }

    return { run, configuration, token, identity };

    function credentialReference(): string {
      if (kind === 'access') {
        return configuration.secretReference;
      }

      const commandReference = secrets['NEXUS_API_KEY'];

      if (commandReference === undefined) {
        throw new FatalError('A Nexus command credential is required to request and collect a token.');
      }

      return commandReference;
    }
  });
}

export function requestUrl(service: RequestService, kind: RequestKind, requestId?: string): URL {
  const url = new URL(service.url);
  const collection = url.pathname.replace(/\/$/u, '');
  const segments = [collection, encodeURIComponent(kind)];

  if (requestId !== undefined) {
    segments.push(encodeURIComponent(requestId));
  }

  url.pathname = segments.join('/');
  url.search = '';
  url.hash = '';

  return url;
}

function nexusUrl(service: RequestService, path: string): URL {
  const url = new URL(service.url);
  const collection = url.pathname.replace(/\/$/u, '');

  if (!collection.endsWith('/requests')) {
    throw new FatalError('The Nexus request collection is invalid.');
  }

  url.pathname = `${collection.slice(0, -'/requests'.length)}${path}`;
  url.search = '';
  url.hash = '';

  return url;
}

export function vendUrl(service: RequestService, connectionId: string): URL {
  const path = ['', 'connections', encodeURIComponent(connectionId), 'vends'].join('/');

  return nexusUrl(service, path);
}

export async function verifyServiceIdentity(service: LoadedService): Promise<void> {
  const url = nexusUrl(service.configuration, '/access');
  const response = await sendNexusRequest({ service, url, method: HttpMethod.Get });
  const identity = ServiceAccess.safeParse(response.payload);

  if (!response.isSuccessful || !identity.success || identity.data.service.id !== service.configuration.serviceId) {
    throw new FatalError('The Nexus credential does not match this mech’s configured service identity.');
  }
}

export async function sendNexusRequest({ service, url, method, body }: RequestTransport): Promise<NexusResponse> {
  const credential = Redacted.value(service.token);

  const headers = new Headers({
    [HttpHeader.Authorization]: `Bearer ${credential}`,
    [HttpHeader.ContentType]: MediaType.Json,
    'nexus-agent-runtime': 'mechane',
    'nexus-agent-instance-id': service.run.mechId,
    'nexus-thread-id': service.run.id,
  });

  const payload = encodedBody(body);

  const request = new Request(url, {
    method,
    headers,
    body: payload,
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const response = await fetch(request).catch(() => {
    throw new RetryableError('Nexus did not confirm the request.');
  });

  if (response.status === HttpStatusCode.TooManyRequests || response.status >= HttpStatusCode.InternalServerError) {
    await response.body?.cancel();

    throw new RetryableError('Nexus could not process the request yet.');
  }

  const serialized = await boundedResponse(response);
  const sanitized = serialized.replaceAll(credential, '[redacted]');

  const decoded = z
    .string()
    .transform((value, context): unknown => {
      try {
        return JSON.parse(value);
      } catch {
        context.addIssue({ code: 'custom', message: 'Invalid Nexus response' });

        return z.NEVER;
      }
    })
    .safeParse(sanitized);

  if (!decoded.success) {
    throw new FatalError('Nexus returned an invalid response.');
  }

  return { isSuccessful: response.ok, status: response.status, payload: decoded.data };
}

function encodedBody(body: unknown): string | null {
  if (body === undefined) {
    return null;
  }

  return JSON.stringify(body);
}

async function boundedResponse(response: Response): Promise<string> {
  if (response.body === null) {
    throw new FatalError('Nexus returned an empty response.');
  }

  const count = { bytes: 0 };

  const bound = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      count.bytes += chunk.byteLength;

      if (count.bytes > RESPONSE_MAX_BYTES) {
        controller.error(new FatalError('Nexus returned an oversized response.'));

        return;
      }

      controller.enqueue(chunk);
    },
  });

  return await new Response(response.body.pipeThrough(bound)).text();
}
