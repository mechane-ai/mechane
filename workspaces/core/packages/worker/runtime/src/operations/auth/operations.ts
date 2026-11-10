import type { AuthKey, AuthRuntimeStore } from '@mechane/control-store';
import { catalog, DeviceApprovalNotFound, KeyMissing, KeyNotFound, TokenPrefix } from '@mechane/protocol';
import { Option, Redacted } from 'effect';
import { randomUUID } from 'node:crypto';
import { requireAuthenticated, validatedOperation } from '../validated-operation.ts';
import { DEVICE_APPROVAL_SECONDS, DEVICE_POLL_SECONDS, KEY_LIFETIME_MAX_SECONDS } from './configuration.ts';
import type { AuthenticationConfiguration } from './configuration.ts';
import { createAuthToken, createUserCode, hashAuthToken } from './secrets.ts';

const KEY_PAGE_RECORDS = 100;
const MILLISECONDS_PER_SECOND = 1000;

type AuthOperationOptions = { readonly store: AuthRuntimeStore; readonly configuration: AuthenticationConfiguration };

function encodedKey(key: AuthKey) {
  return {
    id: key.id,
    name: key.name,
    purpose: key.purpose,
    created_at: key.createdAt,
    expires_at: key.expiresAt,
    revoked_at: key.revokedAt,
  };
}

export function createAuthOperations({ store, configuration }: AuthOperationOptions) {
  const keyLifetimes = { login: configuration.loginKeyLifetimeSeconds, named: configuration.namedKeyLifetimeSeconds };

  return {
    startDeviceApproval: validatedOperation({
      operation: catalog.startDeviceApproval,
      run: async ({ input }) => {
        const userCode = createUserCode();
        const pollToken = createAuthToken(TokenPrefix.Poll);
        const keyLifetimeSeconds = keyLifetimes[input.purpose];

        if (keyLifetimeSeconds <= 0 || keyLifetimeSeconds > KEY_LIFETIME_MAX_SECONDS) {
          throw new Error('Configured key lifetime is outside the permitted range');
        }

        const expiresAt = new Date(Date.now() + DEVICE_APPROVAL_SECONDS * MILLISECONDS_PER_SECOND).toISOString();

        await store.auth.startDeviceApproval({
          id: randomUUID(),
          deviceCodeHash: hashAuthToken(pollToken),
          userCodeHash: hashAuthToken(userCode),
          name: input.name,
          purpose: input.purpose,
          keyLifetimeSeconds,
          expiresAt,
        });

        return {
          user_code: userCode,
          verification_url: new URL('/device', configuration.origin).href,
          poll_token: pollToken,
          interval_seconds: DEVICE_POLL_SECONDS,
          expires_in_seconds: DEVICE_APPROVAL_SECONDS,
        };
      },
    }),

    pollDeviceApproval: validatedOperation({
      operation: catalog.pollDeviceApproval,
      run: async ({ input }) => {
        const token = createAuthToken(TokenPrefix.Key);

        const claim = await store.auth.claimDeviceApproval({
          deviceCodeHash: hashAuthToken(Redacted.value(input.pollToken)),
          keyId: randomUUID(),
          keyTokenHash: hashAuthToken(token),
        });

        if (claim === null) {
          throw new DeviceApprovalNotFound({});
        }

        if (claim.status === 'pending') {
          return { status: 'pending' };
        }

        return { status: 'approved', token, key: encodedKey(claim.key), principal: claim.principal };
      },
    }),

    showPrincipal: validatedOperation({
      operation: catalog.showPrincipal,
      run: async ({ caller }) => {
        const authenticated = requireAuthenticated(caller);
        const principal = await store.auth.findPrincipal({ principalId: authenticated.principalId });

        if (principal === null) {
          throw new KeyMissing({});
        }

        if (authenticated.authKind === 'session') {
          return { principal, key: null };
        }

        const key = await store.auth.showKey({ principalId: authenticated.principalId, keyId: authenticated.keyId });

        if (key === null) {
          throw new KeyMissing({});
        }

        return { principal, key: encodedKey(key) };
      },
    }),

    listKeys: validatedOperation({
      operation: catalog.listKeys,
      run: async ({ input, caller }) => {
        const authenticated = requireAuthenticated(caller);
        const after = Option.getOrNull(input.after);

        const keys = await store.auth.listKeys({
          principalId: authenticated.principalId,
          after,
          limitRecords: KEY_PAGE_RECORDS + 1,
        });

        return { keys: keys.slice(0, KEY_PAGE_RECORDS).map(encodedKey), has_more: keys.length > KEY_PAGE_RECORDS };
      },
    }),

    revokeKey: validatedOperation({
      operation: catalog.revokeKey,
      run: async ({ input, caller }) => {
        const authenticated = requireAuthenticated(caller);
        const key = await store.auth.revokeKey({ principalId: authenticated.principalId, keyId: input.keyId });

        if (key === null) {
          throw new KeyNotFound({ keyId: input.keyId });
        }

        return encodedKey(key);
      },
    }),
  };
}
