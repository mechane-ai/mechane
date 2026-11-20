import type { ControlStore, ManagedScope } from '@mechane/control-store';
import { managedWorkspaceId } from '@mechane/managed-protocol';
import { HttpHeader, HttpStatusCode, RecordId } from '@mechane/records';
import { isInstallationAdministrator, limitAuthentication } from '@mechane/runtime';
import type { AuthenticationConfiguration } from '@mechane/runtime';
import { Schema } from 'effect';
import { authenticateRequest } from '../auth/authenticate.ts';
import { requireBrowserAuthentication } from '../auth/cookies.ts';
import { READ_METHODS } from '../http/methods.ts';
import { ManagedHttpError } from './http-error.ts';
import { authenticateManagedService } from './service-credentials.ts';
import type { ManagedServiceCredentials } from './service-credentials.ts';

const CREDENTIAL_FAILURES: ReadonlySet<number> = new Set([HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden]);

type Authentication = {
  readonly store: ControlStore;
  readonly configuration: AuthenticationConfiguration;
  readonly managedIdentity: ManagedServiceCredentials;
};

function requireSelectedWorkspace(selected: string | null, workspaceId: string) {
  if (selected !== null && selected !== managedWorkspaceId({ workspaceId })) {
    throw new ManagedHttpError(HttpStatusCode.Forbidden, 'Workspace is not accessible');
  }
}

export function managedAuthentication({ store, configuration, managedIdentity }: Authentication) {
  return async (request: Request, peerAddress: string | null): Promise<ManagedScope> => {
    const browser = new URL(request.url).pathname.startsWith('/console-api/');
    const selected = request.headers.get('anthropic-workspace-id');
    let workspaceId = configuration.bootstrapWorkspaceId;

    if (browser && selected !== null) {
      workspaceId = selected;
    }

    if (!Schema.is(RecordId)(workspaceId)) {
      throw new ManagedHttpError(HttpStatusCode.Forbidden, 'Workspace is not accessible');
    }

    const headers = new Headers();

    if (browser) {
      if (!READ_METHODS.has(request.method)) {
        requireBrowserAuthentication({ request, origin: configuration.origin });
      }

      const cookie = request.headers.get(HttpHeader.Cookie);

      if (cookie !== null) {
        headers.set(HttpHeader.Cookie, cookie);
      }

      const origin = request.headers.get(HttpHeader.Origin);

      if (origin !== null) {
        headers.set(HttpHeader.Origin, origin);
      }
    } else {
      const apiKey = request.headers.get(HttpHeader.ApiKey);
      const authorization = request.headers.get(HttpHeader.Authorization);

      if (apiKey !== null && authorization !== null) {
        throw new ManagedHttpError(HttpStatusCode.Unauthorized, 'Use a single API credential');
      }

      try {
        const managed = await authenticateManagedService({ request, settings: managedIdentity, configuration, store });

        if (managed !== null) {
          requireSelectedWorkspace(selected, managed.workspaceId);
          await limitAuthentication({ store, configuration, policy: 'principal', subject: managed.principalId });

          return managed;
        }
      } catch (failure) {
        if (failure instanceof ManagedHttpError && CREDENTIAL_FAILURES.has(failure.status)) {
          await limitAuthentication({ store, configuration, policy: 'address', subject: peerAddress ?? 'unavailable' });
        }

        throw failure;
      }

      requireSelectedWorkspace(selected, workspaceId);

      if (authorization !== null) {
        headers.set(HttpHeader.Authorization, authorization);
      } else if (apiKey !== null && apiKey.length > 0 && !/\s/u.test(apiKey)) {
        headers.set(HttpHeader.Authorization, `Bearer ${apiKey}`);
      }
    }

    const caller = await authenticateRequest({
      request: new Request(request.url, { method: request.method, headers }),
      store,
      configuration,
      peerAddress,
    });

    if (caller.principalId === null) {
      throw new ManagedHttpError(HttpStatusCode.Unauthorized, 'An authenticated principal is required');
    }

    const membership = await store.auth.getMembership({ principalId: caller.principalId, workspaceId });

    if (membership === null) {
      throw new ManagedHttpError(HttpStatusCode.Forbidden, 'Workspace is not accessible');
    }

    const isAdmin = await isInstallationAdministrator({ store, configuration, principalId: caller.principalId });

    if (caller.authKind === 'key') {
      return { workspaceId, principalId: caller.principalId, isAdmin, apiKeyId: caller.keyId };
    }

    return { workspaceId, principalId: caller.principalId, isAdmin };
  };
}
