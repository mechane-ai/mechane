import type { AuthKey, AuthKeyRow } from './types.ts';

export function authKey(row: AuthKeyRow): AuthKey {
  return {
    id: row.id,
    principalId: row.principal_id,
    name: row.name,
    purpose: row.purpose,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}
