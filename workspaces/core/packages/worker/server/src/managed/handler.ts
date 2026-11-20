import { managedWorkspaceId, matchManagedRoute } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import type { AuthenticationConfiguration } from '@mechane/runtime';
import { matchInstalledCommandEnvironment } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import { handleAgents } from './agents.ts';
import { agentAttention } from './attention.ts';
import { managedAuthentication } from './auth.ts';
import { matchConsoleEvidence, readConsoleEvidence } from './console-evidence.ts';
import { handleEnvironmentOperation, handleManagedEnvironmentKeys } from './environment-routes.ts';
import { handleEvents } from './events.ts';
import { managedFailure } from './failure.ts';
import { ManagedHttpError } from './http-error.ts';
import { installedCommandEnvironment } from './installed-command-environment.ts';
import { handleInstalledComputer, matchInstalledComputer } from './installed-computer.ts';
import { handleMemory } from './memory.ts';
import { decodeManagedQuery } from './request-input.ts';
import { scopedManagedRequest } from './scope.ts';
import type { ManagedServiceCredentials } from './service-credentials.ts';
import { handleSessions } from './sessions.ts';
import { handleSkills } from './skills.ts';
import type { ManagedRequest } from './types.ts';
import { handleVaults } from './vaults.ts';
import { managedBody, managedResponse, requireManagedHeaders } from './wire.ts';
import { handleManagedWorkOperation } from './work.ts';

type Dependencies = Pick<
  ManagedRequest,
  'store' | 'configuration' | 'actors' | 'wakeInstalledSession' | 'scheduleSessionOpen'
> & { readonly authentication: AuthenticationConfiguration; readonly managedIdentity: ManagedServiceCredentials };

async function execute(path: string, input: ManagedRequest): Promise<unknown> {
  if (path.startsWith('/v1/agents')) {
    return await handleAgents(input);
  }

  if (path.startsWith('/v1/environments')) {
    return await handleEnvironmentOperation(input);
  }

  if (path.startsWith('/v1/memory_stores')) {
    return await handleMemory(input);
  }

  if (path.startsWith('/v1/vaults')) {
    return await handleVaults(input);
  }

  if (path.startsWith('/v1/skills')) {
    return await handleSkills(input);
  }

  if (path.includes('/events') || path.includes('/threads')) {
    return await handleEvents(input);
  }

  return await handleSessions(input);
}

async function workspaceResponse(path: string, input: ManagedRequest, requestId: string): Promise<Response> {
  try {
    return managedResponse(await execute(path, input), requestId);
  } catch (failure) {
    return managedFailure(failure, input.request, requestId);
  }
}

export function createManagedHandler(dependencies: Dependencies) {
  const { store, actors, configuration, authentication, wakeInstalledSession, scheduleSessionOpen, managedIdentity } =
    dependencies;

  const authenticate = managedAuthentication({ store, configuration: authentication, managedIdentity });

  return async (request: Request, peerAddress: string | null = null): Promise<Response | null> => {
    const url = new URL(request.url);
    let path = url.pathname;

    const isConsole = path.startsWith('/console-api/v1/');

    if (isConsole) {
      path = path.slice('/console-api'.length);
    }

    const computer = matchInstalledComputer(path);
    const evidence = matchConsoleEvidence(path);
    const commandSession = matchInstalledCommandEnvironment({ pathname: path });
    const privateKeys = path.startsWith('/internal/managed/environments/');
    const [, agentId] = /^\/console-api\/agents\/(agent_[a-zA-Z0-9_-]+)\/attention$/u.exec(path) ?? [];

    const isPrivateManagement = privateKeys || agentId !== undefined || evidence !== null;
    const isInstalledSession = computer !== null || Option.isSome(commandSession);

    if (!path.startsWith('/v1/') && !isPrivateManagement && !isInstalledSession) {
      return null;
    }

    const requestId = `req_${crypto.randomUUID().replaceAll('-', '')}`;

    try {
      if (evidence !== null) {
        const response = await readConsoleEvidence({
          route: evidence,
          request,
          configuration,
          store,
          authenticate: (selected) => authenticate(selected, peerAddress),
        });

        response.headers.set(HttpHeader.RequestId, requestId);

        return response;
      }

      if (Option.isSome(commandSession)) {
        return await installedCommandEnvironment({ store, request, sessionId: commandSession.value });
      }

      if (computer !== null) {
        const response = await handleInstalledComputer({
          ...computer,
          store,
          configuration,
          request,
          authenticate: () => authenticate(request, peerAddress),
        });

        response.headers.set(HttpHeader.RequestId, requestId);

        return response;
      }

      if (agentId !== undefined) {
        if (request.method !== HttpMethod.Get) {
          throw new ManagedHttpError(HttpStatusCode.NotFound, 'Resource not found');
        }

        const scope = await authenticate(request, peerAddress);

        return managedResponse(await agentAttention({ actors, scope, store, agentId }), requestId);
      }

      if (privateKeys) {
        const result = await handleManagedEnvironmentKeys({ request, store, authenticate, peerAddress });

        if (result === null) {
          throw new ManagedHttpError(HttpStatusCode.NotFound, 'Resource not found');
        }

        return managedResponse(result, requestId);
      }

      const matched = matchManagedRoute({ method: request.method, pathname: path, isConsole });

      if (Option.isNone(matched)) {
        throw new ManagedHttpError(HttpStatusCode.NotFound, 'Resource not found');
      }

      requireManagedHeaders(request, path);

      const route = matched.value;
      const { operation, params } = route;
      const query = decodeManagedQuery({ route, query: [...url.searchParams] });

      const base = {
        request,
        store,
        configuration,
        actors,
        operation,
        params,
        query,
        wakeInstalledSession,
        scheduleSessionOpen,
      };

      if (route.path.startsWith('/v1/environments/{environment_id}/work')) {
        const body = await managedBody(route, request);

        return managedResponse(
          await handleManagedWorkOperation({ ...base, body, authenticate, peerAddress, origin: authentication.origin }),
          requestId,
        );
      }

      const input = await scopedManagedRequest({ base, route, authenticate: () => authenticate(request, peerAddress) });

      const response = await workspaceResponse(route.path, input, requestId);

      response.headers.set(HttpHeader.AnthropicWorkspaceId, managedWorkspaceId(input.scope));

      return response;
    } catch (failure) {
      return managedFailure(failure, request, requestId);
    }
  };
}
