import {
  IdentityNotAdmitted,
  KeyExpired,
  KeyMissing,
  KeyRevoked,
  KeyUnrecognized,
  RateLimited,
  WorkspaceNotFound,
} from '@mechane/protocol';
import { RecordId } from '@mechane/records';
import { Schema } from 'effect';
import type { AuthRuntimeStore } from '../../store/api/auth/auth.ts';
import type { AuthCaller } from '../types.ts';
import { DEFAULT_AUTH_RATE_LIMITS } from './configuration.ts';
import type { AuthenticationConfiguration, AuthenticationIdentity, AuthRateLimits } from './configuration.ts';
import { hashAuthToken } from './secrets.ts';

type AuthEnvironment = { readonly store: AuthRuntimeStore; readonly configuration: AuthenticationConfiguration };

type ResolveAuthentication = AuthEnvironment & {
  readonly credential: { readonly kind: 'key' | 'session'; readonly token: string };
};

type IdentityAdmission = AuthEnvironment & { readonly principalId: string };

type WorkspaceAdmission = {
  readonly store: AuthRuntimeStore;
  readonly caller: AuthCaller;
  readonly workspaceId: string;
};

type LimitAuthentication = AuthEnvironment & { readonly policy: keyof AuthRateLimits; readonly subject: string };

export function isIdentityAllowed(
  identity: AuthenticationIdentity,
  allowed: ReadonlyArray<AuthenticationIdentity> | null,
): boolean {
  if (allowed === null) {
    return true;
  }

  return allowed.some((entry) => entry.subject === identity.subject);
}

async function requireIdentityAdmission({ store, configuration, principalId }: IdentityAdmission): Promise<void> {
  const identities = await store.auth.principalIdentities({ principalId });

  if (!identities.some((identity) => isIdentityAllowed(identity, configuration.allowedIdentities))) {
    throw new IdentityNotAdmitted({});
  }
}

export async function isInstallationAdministrator({
  store,
  configuration,
  principalId,
}: IdentityAdmission): Promise<boolean> {
  const identities = await store.auth.principalIdentities({ principalId });

  return identities.some((identity) => isIdentityAllowed(identity, configuration.administrators));
}

export async function resolveAuthentication({
  store,
  configuration,
  credential,
}: ResolveAuthentication): Promise<AuthCaller> {
  const tokenHash = hashAuthToken(credential.token);

  if (credential.kind === 'session') {
    const session = await store.auth.findSession({ tokenHash });

    if (session === null) {
      throw new KeyMissing({});
    }

    await requireIdentityAdmission({ store, configuration, principalId: session.principalId });

    return { authKind: 'session', principalId: session.principalId, keyId: null };
  }

  const key = await store.auth.findKey({ tokenHash });

  if (key === null) {
    throw new KeyUnrecognized({});
  }

  if (key.revokedAt !== null) {
    throw new KeyRevoked({});
  }

  if (Date.parse(key.expiresAt) <= Date.now()) {
    throw new KeyExpired({ expiresAt: Schema.decodeUnknownSync(Schema.DateTimeUtcFromString)(key.expiresAt) });
  }

  await requireIdentityAdmission({ store, configuration, principalId: key.principalId });

  return { authKind: 'key', principalId: key.principalId, keyId: key.id };
}

export async function requireWorkspaceMember({
  store,
  caller,
  workspaceId,
}: WorkspaceAdmission): Promise<'owner' | 'member'> {
  if (caller.principalId === null) {
    throw new KeyMissing({});
  }

  const role = await store.auth.getMembership({ principalId: caller.principalId, workspaceId });

  if (role === null) {
    throw new WorkspaceNotFound({ workspaceId: Schema.decodeUnknownSync(RecordId)(workspaceId) });
  }

  return role;
}

export async function limitAuthentication({
  store,
  configuration,
  policy,
  subject,
}: LimitAuthentication): Promise<void> {
  const limits = configuration.rateLimits ?? DEFAULT_AUTH_RATE_LIMITS;
  const selected = limits[policy];
  const bucket = `${policy}:${hashAuthToken(subject)}`;

  const retryAfterSeconds = await store.auth.takeAttempt({
    bucket,
    limitAttempts: selected.requests,
    windowSeconds: selected.windowSeconds,
  });

  if (retryAfterSeconds !== null) {
    throw new RateLimited({ retryAfterSeconds });
  }
}
