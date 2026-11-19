import { isInstalledEnvironment } from '@mechane/control-store';
import type { ControlStore, ManagedScope } from '@mechane/control-store';
import { ConsoleSessionEvidencePage } from '@mechane/protocol';
import { EvidenceArtifactId, HttpHeader, HttpMethod, HttpStatusCode, WorkspaceId } from '@mechane/records';
import type { RuntimeConfiguration } from '@mechane/runtime';
import { Schema } from 'effect';
import { ManagedHttpError } from './http-error.ts';
import { privateComputerHeaders, proxyInstalledComputer, sessionComputer } from './installed-computer.ts';

const EVIDENCE_PATH =
  /^\/console-api\/workspaces\/([^/]+)\/agents\/(agent_[A-Za-z0-9_-]{1,128})\/sessions\/(sesn_[A-Za-z0-9_-]{1,128})\/evidence(?:\/([^/]+)(\/content)?)?$/u;

type Route = {
  readonly workspaceId: string;
  readonly agentId: string;
  readonly sessionId: string;
  readonly resource: string;
  readonly hasContent: boolean;
};

type Read = {
  readonly route: Route;
  readonly request: Request;
  readonly configuration: RuntimeConfiguration;
  readonly store: ControlStore;
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

  return { workspaceId, agentId, sessionId, resource, hasContent: content !== undefined };
}

export async function readConsoleEvidence({
  route,
  request,
  configuration,
  store,
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

  if (!isInstalledEnvironment(computer)) {
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
