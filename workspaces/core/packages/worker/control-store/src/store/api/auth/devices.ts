import type { StoreContext } from '../../context.ts';
import { authKey } from './auth-key.ts';
import type { AuthKeyRow, AuthPrincipal, DeviceApprovalRecord, DeviceClaim } from './types.ts';

type StartDevice = {
  readonly id: string;
  readonly deviceCodeHash: string;
  readonly userCodeHash: string;
  readonly name: string;
  readonly purpose: 'login' | 'named';
  readonly keyLifetimeSeconds: number;
  readonly expiresAt: string;
};

type ReviewDevice = { readonly userCodeHash: string };
type ApproveDevice = { readonly userCodeHash: string; readonly sessionTokenHash: string };
type ClaimDevice = { readonly deviceCodeHash: string; readonly keyId: string; readonly keyTokenHash: string };

type DeviceRow = {
  readonly id: string;
  readonly name: string;
  readonly purpose: 'login' | 'named';
  readonly key_lifetime_seconds: number;
  readonly created_at: string;
  readonly expires_at: string;
  readonly principal_id: string | null;
  readonly status: 'pending' | 'approved' | 'denied' | 'claimed';
};

type TakeAttempt = { readonly bucket: string; readonly limitAttempts: number; readonly windowSeconds: number };
type AttemptRow = { readonly attempts: number; readonly retry_after_seconds: number };

function deviceRecord(row: DeviceRow): DeviceApprovalRecord {
  return {
    id: row.id,
    name: row.name,
    purpose: row.purpose,
    keyLifetimeSeconds: row.key_lifetime_seconds,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export function createDeviceStore(context: StoreContext) {
  return {
    async startDeviceApproval(input: StartDevice): Promise<void> {
      await context.client.query('DELETE FROM mechane.device_approvals WHERE expires_at<=now()');
      await context.client.query(
        "INSERT INTO mechane.device_approvals(id,device_code_hash,user_code_hash,name,purpose,key_lifetime_seconds,status,expires_at) VALUES($1,$2,$3,$4,$5,$6,'pending',$7)",
        [
          input.id,
          input.deviceCodeHash,
          input.userCodeHash,
          input.name,
          input.purpose,
          input.keyLifetimeSeconds,
          input.expiresAt,
        ],
      );
    },

    async findPendingDeviceApproval({ userCodeHash }: ReviewDevice): Promise<DeviceApprovalRecord | null> {
      const result = await context.client.query<DeviceRow>(
        "SELECT id,name,purpose,key_lifetime_seconds,created_at,expires_at,principal_id,status FROM mechane.device_approvals WHERE user_code_hash=$1 AND status='pending' AND expires_at>now()",
        [userCodeHash],
      );

      const row = result.rows[0];

      if (row === undefined) {
        return null;
      }

      return deviceRecord(row);
    },

    async approveDevice({ userCodeHash, sessionTokenHash }: ApproveDevice): Promise<DeviceApprovalRecord | null> {
      const result = await context.client.query<DeviceRow>(
        "UPDATE mechane.device_approvals approval SET status='approved',principal_id=session.principal_id FROM mechane.browser_sessions session WHERE approval.user_code_hash=$1 AND approval.status='pending' AND approval.expires_at>now() AND session.token_hash=$2 AND session.expires_at>now() RETURNING approval.id,approval.name,approval.purpose,approval.key_lifetime_seconds,approval.created_at,approval.expires_at,approval.principal_id,approval.status",
        [userCodeHash, sessionTokenHash],
      );

      const row = result.rows[0];

      if (row === undefined) {
        return null;
      }

      return deviceRecord(row);
    },

    async claimDeviceApproval({ deviceCodeHash, keyId, keyTokenHash }: ClaimDevice): Promise<DeviceClaim | null> {
      return await context.atomic(async ({ client }) => {
        const selected = await client.query<DeviceRow>(
          'SELECT id,name,purpose,key_lifetime_seconds,created_at,expires_at,principal_id,status FROM mechane.device_approvals WHERE device_code_hash=$1 AND expires_at>now() FOR UPDATE',
          [deviceCodeHash],
        );

        const approval = selected.rows[0];

        if (approval === undefined) {
          return null;
        }

        if (approval.status === 'pending') {
          return { status: 'pending' };
        }

        if (approval.status !== 'approved' || approval.principal_id === null) {
          return null;
        }

        const principalResult = await client.query<AuthPrincipal>(
          'SELECT id,name FROM mechane.principals WHERE id=$1',
          [approval.principal_id],
        );

        const principal = principalResult.rows[0];

        if (principal === undefined) {
          throw new Error('Approved device principal is missing');
        }

        const issued = await client.query<AuthKeyRow>(
          'INSERT INTO mechane.api_keys(id,principal_id,token_hash,name,purpose,approved_by,expires_at) VALUES($1,$2,$3,$4,$5,$2,now()+make_interval(secs=>$6)) RETURNING id,principal_id,name,purpose,created_at,expires_at,revoked_at',
          [keyId, principal.id, keyTokenHash, approval.name, approval.purpose, approval.key_lifetime_seconds],
        );

        const key = issued.rows[0];

        if (key === undefined) {
          throw new Error('Issued device key is missing');
        }

        await client.query("UPDATE mechane.device_approvals SET status='claimed',api_key_id=$2 WHERE id=$1", [
          approval.id,
          keyId,
        ]);

        return { status: 'approved', key: authKey(key), principal };
      });
    },

    async takeAttempt({ bucket, limitAttempts, windowSeconds }: TakeAttempt): Promise<number | null> {
      await context.client.query("DELETE FROM mechane.auth_attempts WHERE expires_at<now()-interval '1 day'");

      const result = await context.client.query<AttemptRow>(
        'INSERT INTO mechane.auth_attempts(bucket,window_start,expires_at,attempts) VALUES($1,now(),now()+make_interval(secs=>$2),1) ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN mechane.auth_attempts.expires_at<=now() THEN 1 ELSE mechane.auth_attempts.attempts+1 END,window_start=CASE WHEN mechane.auth_attempts.expires_at<=now() THEN now() ELSE mechane.auth_attempts.window_start END,expires_at=CASE WHEN mechane.auth_attempts.expires_at<=now() THEN now()+make_interval(secs=>$2) ELSE mechane.auth_attempts.expires_at END RETURNING attempts,greatest(1,ceil(extract(epoch FROM expires_at-now())))::int AS retry_after_seconds',
        [bucket, windowSeconds],
      );

      const row = result.rows[0];

      if (row === undefined) {
        throw new Error('Authentication rate limit did not return a result');
      }

      if (row.attempts > limitAttempts) {
        return row.retry_after_seconds;
      }

      return null;
    },
  };
}
