import { isInstalledEnvironment } from '@mechane/control-store';
import type { ControlStore, ManagedScope } from '@mechane/control-store';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import type { RuntimeConfiguration } from '@mechane/runtime';
import {
  InstalledCheckpointRepair,
  installedComputerAccess,
  installedComputerQuery,
  installedComputerServicePath,
} from '@mechane/sandbox-wire';
import { Option, Redacted, Result, Schema } from 'effect';
import { readJsonBody, readTextBody } from '../http/body.ts';
import { ManagedHttpError } from './http-error.ts';
import { linkInstalledCapture } from './installed-capture-link.ts';
import { startInstalledProcess } from './installed-process-start.ts';
import { requireWorkerWorkspace, workerBearer } from './work-auth.ts';

const ComputerPath = /^\/internal\/managed\/sessions\/(sesn_[A-Za-z0-9_-]{1,128})\/computer\/(.+)$/u;
const REQUEST_TIMEOUT_MS = 30_000;

const PRIVATE_HEADERS = {
  [HttpHeader.CacheControl]: 'private, no-store',
  [HttpHeader.XContentTypeOptions]: 'nosniff',
} as const;

const READ_HEADERS: ReadonlyArray<HttpHeader> = [
  HttpHeader.ContentType,
  HttpHeader.ContentLength,
  HttpHeader.ContentRange,
  HttpHeader.AcceptRanges,
  HttpHeader.ContentDisposition,
];

type Endpoint = { readonly sessionId: string; readonly resource: string };

type Computer = { readonly workspaceId: string; readonly environmentId: string; readonly sessionId: string };

type RequestScope = {
  readonly store: ControlStore;
  readonly request: Request;
  readonly authenticate: () => Promise<ManagedScope>;
  readonly configuration: RuntimeConfiguration;
};

export function matchInstalledComputer(path: string): Endpoint | null {
  const [, sessionId, resource] = ComputerPath.exec(path) ?? [];

  if (sessionId === undefined || resource === undefined) {
    return null;
  }

  return { sessionId, resource };
}

export function privateComputerHeaders(configuration: RuntimeConfiguration): Headers {
  return new Headers({ [HttpHeader.Authorization]: `Bearer ${Redacted.value(configuration.sandbox.bearer)}` });
}

export async function sessionComputer(store: ControlStore, scope: ManagedScope, sessionId: string) {
  const { agentId, environmentId } = await store.managed.sessions.runtimeBinding({ scope, id: sessionId });

  return { workspaceId: scope.workspaceId, agentId, environmentId, sessionId };
}

async function resolveComputer(input: RequestScope & Endpoint) {
  const { store, request, sessionId, authenticate, resource, configuration } = input;
  const headers = privateComputerHeaders(configuration);
  const classification = installedComputerAccess({ method: request.method, resource });

  if (Option.isNone(classification)) {
    throw new ManagedHttpError(HttpStatusCode.NotFound, 'Computer operation not found');
  }

  const access = classification.value;

  const token = workerBearer(request);

  if (token.startsWith('sk-ant-req-')) {
    if (access === 'repair') {
      throw new ManagedHttpError(HttpStatusCode.Forbidden, 'Computer repair requires a workspace owner');
    }

    if (request.headers.has(HttpHeader.ApiKey)) {
      throw new ManagedHttpError(HttpStatusCode.Forbidden, 'Use a single worker credential');
    }

    const grant = await store.managed.worker.allocations.authorizeComputer({ token, sessionId, access });

    if (grant === null) {
      throw new ManagedHttpError(
        HttpStatusCode.Forbidden,
        'The workspace or worker lease does not allow this computer operation',
      );
    }

    requireWorkerWorkspace(request, grant.workspaceId);
    headers.set(HttpHeader.MechaneAllocationGeneration, String(grant.generation));
    headers.set(HttpHeader.MechaneWorkId, grant.workId);

    return { computer: grant, headers };
  }

  const scope = await authenticate();

  if (access === 'tool') {
    throw new ManagedHttpError(HttpStatusCode.Forbidden, 'This operation requires the session worker');
  }

  if (access === 'repair') {
    const membership = await store.auth.getMembership({
      principalId: scope.principalId,
      workspaceId: scope.workspaceId,
    });

    if (membership !== 'owner') {
      throw new ManagedHttpError(HttpStatusCode.Forbidden, 'Computer repair requires a workspace owner');
    }
  }

  const session = await sessionComputer(store, scope, sessionId);

  if (!isInstalledEnvironment(session)) {
    throw new ManagedHttpError(HttpStatusCode.NotFound, 'This session has no installed computer');
  }

  return { computer: session, headers };
}

export async function handleInstalledComputer(input: RequestScope & Endpoint): Promise<Response> {
  const resolved = await resolveComputer(input);
  const response = await proxyInstalledComputer(input, resolved);
  const { computer } = resolved;

  if (!('workId' in computer)) {
    return response;
  }

  return await linkInstalledCapture({
    computer,
    resource: input.resource,
    response,
    publicOrigin: input.configuration.publicOrigin,
  });
}

type BoundComputer = { readonly computer: Computer; readonly headers: Headers };

export async function proxyInstalledComputer(
  input: Omit<RequestScope, 'authenticate'> & Endpoint,
  { computer, headers: grantedHeaders }: BoundComputer,
): Promise<Response> {
  const { request, resource, configuration } = input;
  const headers = new Headers(grantedHeaders);
  const path = installedComputerServicePath({ ...computer, resource });
  const destination = new URL(path, configuration.sandbox.origin);
  const query = new URL(request.url).searchParams;

  const normalized = installedComputerQuery({ resource, query });

  if (Option.isNone(normalized)) {
    throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Invalid computer receipt cursor');
  }

  destination.search = normalized.value;

  if (resource === 'allocation') {
    const allocation = await input.store.managed.worker.allocations.status(computer);

    return Response.json({ allocation }, { headers: PRIVATE_HEADERS });
  }

  const range = request.headers.get(HttpHeader.Range);

  if (range !== null && resource.startsWith('evidence/') && resource.endsWith('/content')) {
    headers.set(HttpHeader.Range, range);
  }

  const options: RequestInit = {
    method: request.method,
    headers,
    redirect: 'error',
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
  };

  async function forward(): Promise<Response> {
    if (request.method !== HttpMethod.Post) {
      return await fetch(destination, options);
    }

    if (request.headers.get(HttpHeader.ContentType)?.split(';')[0]?.trim() !== MediaType.Json) {
      throw new ManagedHttpError(HttpStatusCode.BadRequest, 'Expected application/json');
    }

    headers.set(HttpHeader.ContentType, MediaType.Json);

    async function submit(body: string): Promise<Response> {
      return await fetch(destination, { ...options, body });
    }

    if (/^processes\/[^/]+$/u.test(resource)) {
      return await startInstalledProcess({ ...input, submit });
    }

    if (resource.startsWith('workspace/recovery-checkpoints/')) {
      const submitted = Schema.decodeUnknownResult(InstalledCheckpointRepair, { onExcessProperty: 'error' })(
        await readJsonBody(request),
      );

      if (Result.isFailure(submitted)) {
        throw new ManagedHttpError(
          HttpStatusCode.BadRequest,
          'Expected the observed allocation, machine and file generations',
        );
      }

      const allocation = await input.store.managed.worker.allocations.status(computer);

      if (allocation?.state !== 'releasing' || allocation.generation !== submitted.success.generation) {
        throw new ManagedHttpError(HttpStatusCode.Conflict, 'The original allocation is not waiting for release');
      }

      return await submit(Schema.encodeSync(Schema.fromJsonString(InstalledCheckpointRepair))(submitted.success));
    }

    return await submit(await readTextBody(request));
  }

  const reply = await forward();

  if (reply.status === HttpStatusCode.Unauthorized || reply.status >= HttpStatusCode.InternalServerError) {
    await reply.body?.cancel();

    throw new ManagedHttpError(HttpStatusCode.Unavailable, 'The session computer is unavailable');
  }

  const isRepairRefusal =
    resource.startsWith('workspace/recovery-checkpoints/') && reply.status === HttpStatusCode.Conflict;

  if (!reply.ok && !isRepairRefusal && reply.status !== HttpStatusCode.RangeNotSatisfiable) {
    await reply.body?.cancel();

    if (reply.status === HttpStatusCode.Conflict) {
      throw new ManagedHttpError(reply.status, 'The allocation or original operation has changed');
    }

    if (reply.status === HttpStatusCode.NotFound) {
      throw new ManagedHttpError(reply.status, 'Computer receipt not found');
    }

    throw new ManagedHttpError(reply.status, 'The computer rejected the request');
  }

  const visible = new Headers(PRIVATE_HEADERS);

  for (const key of READ_HEADERS) {
    const value = reply.headers.get(key);

    if (value !== null) {
      visible.set(key, value);
    }
  }

  return new Response(reply.body, { status: reply.status, headers: visible });
}
