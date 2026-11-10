import type { Identity } from '../../../domain.ts';

export type AuthPrincipal = { readonly id: string; readonly name: string };

export type AuthKey = {
  readonly id: string;
  readonly principalId: string;
  readonly name: string;
  readonly purpose: 'login' | 'named';
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
};

export type AuthSession = { readonly principalId: string; readonly expiresAt: string };

export type AuthBootstrap = {
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly dailyCapMicros: number;
};

export type OpenIdentitySession = {
  readonly identity: Identity;
  readonly signInTokenHash: string;
  readonly tokenHash: string;
  readonly expiresAt: string;
  readonly bootstrap: AuthBootstrap | null;
  readonly personalDailyCapMicros: number;
};

export type DeviceApprovalRecord = {
  readonly id: string;
  readonly name: string;
  readonly purpose: 'login' | 'named';
  readonly keyLifetimeSeconds: number;
  readonly createdAt: string;
  readonly expiresAt: string;
};

export type DeviceClaim =
  | { readonly status: 'pending' }
  | { readonly status: 'approved'; readonly key: AuthKey; readonly principal: AuthPrincipal };

export type AuthKeyRow = {
  readonly id: string;
  readonly principal_id: string;
  readonly name: string;
  readonly purpose: 'login' | 'named';
  readonly created_at: string;
  readonly expires_at: string;
  readonly revoked_at: string | null;
};
