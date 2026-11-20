import { isInstalledEnvironment } from '@mechane/control-store';
import type { ControlStore, ManagedScope } from '@mechane/control-store';
import { ConsoleSessionEvidencePage } from '@mechane/protocol';
import { EvidenceArtifactId, HttpHeader, HttpMethod, HttpStatusCode, WorkspaceId } from '@mechane/records';
import type { RuntimeConfiguration } from '@mechane/runtime';
import { SandboxEvidenceMetadata } from '@mechane/sandbox-provider';
import { Schema } from 'effect';
import { ManagedHttpError } from './http-error.ts';
import { privateComputerHeaders, proxyInstalledComputer, sessionComputer } from './installed-computer.ts';

const EVIDENCE_PATH =
  /^\/console-api\/workspaces\/([^/]+)\/agents\/(agent_[A-Za-z0-9_-]{1,128})\/sessions\/(sesn_[A-Za-z0-9_-]{1,128})\/evidence(?:\/([^/]+)(\/content)?)?$/u;

const DIRECT_EVIDENCE_LIST_MAX_ROWS = 100;

const PRIVATE_EVIDENCE_HEADERS = {
  [HttpHeader.CacheControl]: 'private, no-store',
  [HttpHeader.XContentTypeOptions]: 'nosniff',
} as const;

type Route = {
  readonly workspaceId: string;
  readonly agentId: string;
  readonly sessionId: string;
  readonly artifactId: string | undefined;
  readonly resource: string;
  readonly hasContent: boolean;
};

type Read = {
  readonly route: Route;
  readonly request: Request;
  readonly configuration: RuntimeConfiguration;
  readonly store: ControlStore;
  readonly workspaceFiles: R2Bucket | undefined;
  readonly authenticate: (request: Request) => Promise<ManagedScope>;
};

export function matchConsoleEvidence(path: string): Route | null {
  const [, workspaceId, agentId, sessionId, artifactId, content] = EVIDENCE_PATH.exec(path) ?? [];

  if (!Schema.is(WorkspaceId)(workspaceId) || agentId === undefined || sessionId === undefined) {
    return null;
  }

  if (artifactId !== undefined && !Schema.is(EvidenceArtifactId)(artifactId)) {
    return null;
  }

  const resource = ['evidence', artifactId, content?.slice(1)].filter(Boolean).join('/');

  return { workspaceId, agentId, sessionId, artifactId, resource, hasContent: content !== undefined };
}

async function tryReadDirectEvidence({
  route,
  request,
  store,
  workspaceFiles,
}: Pick<Read, 'route' | 'request' | 'store' | 'workspaceFiles'>): Promise<Response | null> {
  if (route.artifactId !== undefined) {
    const stored = await store.managed.evidence.get({
      workspaceId: route.workspaceId,
      sessionId: route.sessionId,
      artifactId: route.artifactId,
    });

    if (stored === null) {
      return null;
    }

    if (!route.hasContent) {
      const payload = Schema.encodeSync(SandboxEvidenceMetadata)(stored);

      return Response.json(payload, { headers: PRIVATE_EVIDENCE_HEADERS });
    }

    if (workspaceFiles === undefined) {
      throw new ManagedHttpError(HttpStatusCode.Unavailable, 'Workspace object storage is not configured');
    }

    const object = await workspaceFiles.get(stored.r2Key);

    if (object === null) {
      throw new ManagedHttpError(HttpStatusCode.NotFound, 'Evidence content is missing');
    }

    const headers = new Headers({
      ...PRIVATE_EVIDENCE_HEADERS,
      [HttpHeader.ContentType]: stored.mediaType,
      [HttpHeader.ContentLength]: String(stored.sizeBytes),
    });

    if (request.method === HttpMethod.Head) {
      return new Response(null, { status: HttpStatusCode.Ok, headers });
    }

    return new Response(object.body, { status: HttpStatusCode.Ok, headers });
  }

  const rows = await store.managed.evidence.list({
    workspaceId: route.workspaceId,
    sessionId: route.sessionId,
    maxRows: DIRECT_EVIDENCE_LIST_MAX_ROWS,
  });

  if (rows.length === 0) {
    return null;
  }

  const artifacts = rows.map((row) => Schema.encodeSync(SandboxEvidenceMetadata)(row));

  return Response.json({ artifacts, hasMore: false }, { headers: PRIVATE_EVIDENCE_HEADERS });
}

export async function readConsoleEvidence({
  route,
  request,
  configuration,
  store,
  workspaceFiles,
  authenticate,
}: Read): Promise<Response> {
  const isHead = request.method === HttpMethod.Head;

  if (request.method !== HttpMethod.Get && !(isHead && route.hasContent)) {
    throw new ManagedHttpError(HttpStatusCode.NotFound, 'Evidence operation not found');
  }

  if (request.headers.has(HttpHeader.Authorization) || request.headers.has(HttpHeader.ApiKey)) {
    throw new ManagedHttpError(HttpStatusCode.Unauthorized, 'Use the Console browser session');
  }

  const selected = request.headers.get(HttpHeader.AnthropicWorkspaceId);

  if (selected !== null && selected !== route.workspaceId) {
    throw new ManagedHttpError(HttpStatusCode.Forbidden, 'Workspace is not accessible');
  }

  const selection = new Headers(request.headers);

  selection.set(HttpHeader.AnthropicWorkspaceId, route.workspaceId);

  const read = new Request(request.url, { method: request.method, headers: selection, signal: request.signal });
  const scope = await authenticate(read);
  const computer = await sessionComputer(store, scope, route.sessionId);

  if (computer.workspaceId !== route.workspaceId || computer.agentId !== route.agentId) {
    throw new ManagedHttpError(HttpStatusCode.NotFound, 'Session not found');
  }

  const direct = await tryReadDirectEvidence({ route, request: read, store, workspaceFiles });

  if (direct !== null) {
    return direct;
  }

  const hasCloudflareProxy = isInstalledEnvironment(computer) && configuration.sandbox.provider === 'cloudflare';

  if (!hasCloudflareProxy) {
    if (route.resource === 'evidence') {
      const page = Schema.encodeSync(ConsoleSessionEvidencePage)({ artifacts: [], hasMore: false });

      return Response.json(page, { headers: { [HttpHeader.CacheControl]: 'private, no-store' } });
    }

    throw new ManagedHttpError(HttpStatusCode.NotFound, 'This session has no installed evidence');
  }

  const headers = privateComputerHeaders(configuration);
  const input = { configuration, store, request: read, resource: route.resource, sessionId: route.sessionId };

  return await proxyInstalledComputer(input, { computer, headers });
}
