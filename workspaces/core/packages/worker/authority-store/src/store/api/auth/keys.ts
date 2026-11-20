import type { StoreContext } from '../../context.ts';
import { authKey } from './auth-key.ts';
import type { AuthKey, AuthKeyRow } from './types.ts';

type FindKeyInput = { readonly tokenHash: string };
type KeyPageInput = { readonly principalId: string; readonly after: string | null; readonly limitRecords: number };
type RevokeKeyInput = { readonly principalId: string; readonly keyId: string };
type ShowKeyInput = { readonly principalId: string; readonly keyId: string };

export function createKeyStore(context: StoreContext) {
  return {
    async findKey({ tokenHash }: FindKeyInput): Promise<AuthKey | null> {
      const result = await context.client.query<AuthKeyRow>(
        'SELECT id,principal_id,name,purpose,created_at,expires_at,revoked_at FROM mechane.api_keys WHERE token_hash=$1',
        [tokenHash],
      );

      const row = result.rows[0];

      if (row === undefined) {
        return null;
      }

      return authKey(row);
    },

    async showKey({ principalId, keyId }: ShowKeyInput): Promise<AuthKey | null> {
      const result = await context.client.query<AuthKeyRow>(
        'SELECT id,principal_id,name,purpose,created_at,expires_at,revoked_at FROM mechane.api_keys WHERE id=$1 AND principal_id=$2',
        [keyId, principalId],
      );

      const row = result.rows[0];

      if (row === undefined) {
        return null;
      }

      return authKey(row);
    },

    async listKeys({ principalId, after, limitRecords }: KeyPageInput): Promise<ReadonlyArray<AuthKey>> {
      const result = await context.client.query<AuthKeyRow>(
        'SELECT id,principal_id,name,purpose,created_at,expires_at,revoked_at FROM mechane.api_keys WHERE principal_id=$1 AND ($2::uuid IS NULL OR (created_at,id)>(SELECT created_at,id FROM mechane.api_keys WHERE id=$2 AND principal_id=$1)) ORDER BY created_at,id LIMIT $3',
        [principalId, after, limitRecords],
      );

      return result.rows.map(authKey);
    },

    async revokeKey({ principalId, keyId }: RevokeKeyInput): Promise<AuthKey | null> {
      const result = await context.client.query<AuthKeyRow>(
        'UPDATE mechane.api_keys SET revoked_at=coalesce(revoked_at,now()) WHERE id=$1 AND principal_id=$2 RETURNING id,principal_id,name,purpose,created_at,expires_at,revoked_at',
        [keyId, principalId],
      );

      const row = result.rows[0];

      if (row === undefined) {
        return null;
      }

      return authKey(row);
    },
  };
}
