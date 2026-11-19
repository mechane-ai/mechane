import type { ControlStore, ManagedScope } from '@mechane/control-store';
import { TokenPrefix } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { hashAuthToken } from '@mechane/runtime';
import type { AuthenticationConfiguration } from '@mechane/runtime';
import { Schema } from 'effect';
import { createHash, timingSafeEqual } from 'node:crypto';
import { bearerToken } from '../auth/bearer.ts';
import { authenticateManagedOidc } from '../oidc/authenticate.ts';
import { loadManagedIdentitySettings } from '../oidc/settings.ts';
import type { ManagedIdentitySettings } from '../oidc/settings.ts';
import type { SettingsEnvironment } from '../settings/environment.ts';
import { optionalSetting } from '../settings/environment.ts';
import { ManagedHttpError } from './http-error.ts';

export type ManagedServiceCredentials = {
  readonly issuers: ManagedIdentitySettings;
  readonly keyDigest: Uint8Array | null;
  readonly isServerApiKeyRefused: boolean;
};

type PublicCredential = {
  readonly request: Request;
  readonly store: ControlStore;
  readonly settings: ManagedServiceCredentials;
  readonly configuration: AuthenticationConfiguration;
};

function digest(value: string): Uint8Array {
  return createHash('sha256').update(value).digest();
}

export function loadManagedServiceCredentials(environment: SettingsEnvironment): ManagedServiceCredentials {
  const issuers = loadManagedIdentitySettings(environment);
  const refuse = optionalSetting({ environment, name: 'MECHANE_REFUSE_SERVER_API_KEY', fallback: 'false' });
  const isServerApiKeyRefused = Schema.decodeUnknownSync(Schema.Literals(['true', 'false']))(refuse) === 'true';

  if (isServerApiKeyRefused && issuers.length === 0) {
    throw new Error('Refusing the managed server API key requires an OIDC issuer');
  }

  const key = environment['MECHANE_SERVER_API_KEY'];

  if (key === undefined) {
    return { issuers, keyDigest: null, isServerApiKeyRefused };
  }

  if (typeof key !== 'string' || key.length === 0 || /\s/u.test(key)) {
    throw new Error('Invalid managed server API key binding');
  }

  return { issuers, keyDigest: digest(key), isServerApiKeyRefused };
}

export async function authenticateManagedService({
  request,
  store,
  configuration,
  settings,
}: PublicCredential): Promise<ManagedScope | null> {
  const workspace = {
    workspaceId: configuration.bootstrapWorkspaceId,
    workspaceName: configuration.bootstrapWorkspaceName,
    dailyCapMicros: configuration.dailyCapMicros,
  };

  const authorization = request.headers.get(HttpHeader.Authorization);
  let token = request.headers.get(HttpHeader.ApiKey);

  if (authorization !== null) {
    token = bearerToken({ authorization });
  }

  if (token?.startsWith(TokenPrefix.WorkspaceService) === true) {
    if (settings.isServerApiKeyRefused) {
      throw new ManagedHttpError(HttpStatusCode.Unauthorized, 'Native API keys are disabled');
    }

    const service = await store.auth.resolveWorkspaceServiceKey({ tokenHash: hashAuthToken(token) });

    if (service === null) {
      throw new ManagedHttpError(HttpStatusCode.Unauthorized, 'Service key is not active');
    }

    return {
      workspaceId: service.workspace_id,
      principalId: service.principal_id,
      isAdmin: false,
      apiKeyId: service.key_id,
    };
  }

  if (settings.keyDigest === null && settings.issuers.length === 0) {
    return null;
  }

  if (token !== null && settings.keyDigest !== null && timingSafeEqual(digest(token), settings.keyDigest)) {
    if (settings.isServerApiKeyRefused) {
      throw new ManagedHttpError(HttpStatusCode.Unauthorized, 'The server API key is disabled');
    }

    const principalId = await store.auth.resolveManagedInstallation(workspace);

    return { workspaceId: workspace.workspaceId, principalId, isAdmin: true };
  }

  const scope = await authenticateManagedOidc({ request, store, workspace, settings: settings.issuers });

  if (scope === null) {
    throw new ManagedHttpError(HttpStatusCode.Unauthorized, 'Use an installation credential');
  }

  return scope;
}
