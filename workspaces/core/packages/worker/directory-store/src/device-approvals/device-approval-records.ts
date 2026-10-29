import { decodeFirst } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime } from 'effect';
import type { Option } from 'effect';
import { DeviceApprovalRow } from '../schemas.ts';
import type {
  ClaimableDeviceApprovalInput,
  DeviceApprovalRecords,
  OpenDeviceApprovalInput,
  PendingDeviceApprovalInput,
  RecordApprovalInput,
  RecordClaimInput,
} from '../types.ts';

/** The directory's device approvals: their opening, approval and claim, and the reads of a pending or claimable one. */
export function deviceApprovalRecords({ sql }: RecordsInput): DeviceApprovalRecords {
  return {
    openDeviceApproval: (input) => openDeviceApproval({ sql, ...input }),
    pendingDeviceApproval: (input) => pendingDeviceApproval({ sql, ...input }),
    claimableDeviceApproval: (input) => claimableDeviceApproval({ sql, ...input }),
    recordApproval: (input) => recordApproval({ sql, ...input }),
    recordClaim: (input) => recordClaim({ sql, ...input }),
  };
}

function openDeviceApproval({ sql, approval }: SqlCall<OpenDeviceApprovalInput>): void {
  sql.exec('DELETE FROM device_approvals WHERE expires_at_ms <= ?', DateTime.toEpochMillis(approval.createdAt));
  sql.exec(
    'INSERT INTO device_approvals (id, user_code, poll_token_hash, purpose, key_name, key_lifetime_ms, created_at_ms, expires_at_ms, peer_address, peer_country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    approval.id,
    approval.userCode,
    approval.pollTokenHash,
    approval.purpose,
    approval.keyName,
    approval.keyLifetimeMs,
    DateTime.toEpochMillis(approval.createdAt),
    DateTime.toEpochMillis(approval.expiresAt),
    approval.peerAddress,
    approval.peerCountry,
  );
}

function pendingDeviceApproval({
  sql,
  userCode,
  now,
}: SqlCall<PendingDeviceApprovalInput>): Option.Option<DeviceApprovalRow> {
  const cursor = sql.exec(
    'SELECT id, purpose, key_name, key_lifetime_ms, created_at_ms, peer_address, peer_country, approver_id FROM device_approvals WHERE user_code = ? AND expires_at_ms > ? AND approver_id IS NULL',
    userCode,
    DateTime.toEpochMillis(now),
  );

  return decodeFirst({ cursor, schema: DeviceApprovalRow });
}

function claimableDeviceApproval({
  sql,
  pollTokenHash,
  now,
}: SqlCall<ClaimableDeviceApprovalInput>): Option.Option<DeviceApprovalRow> {
  const cursor = sql.exec(
    'SELECT id, purpose, key_name, key_lifetime_ms, created_at_ms, peer_address, peer_country, approver_id FROM device_approvals WHERE poll_token_hash = ? AND expires_at_ms > ? AND key_id IS NULL',
    pollTokenHash,
    DateTime.toEpochMillis(now),
  );

  return decodeFirst({ cursor, schema: DeviceApprovalRow });
}

function recordApproval({ sql, approvalId, principalId }: SqlCall<RecordApprovalInput>): void {
  sql.exec('UPDATE device_approvals SET approver_id = ? WHERE id = ?', principalId, approvalId);
}

function recordClaim({ sql, approvalId, keyId }: SqlCall<RecordClaimInput>): void {
  sql.exec('UPDATE device_approvals SET key_id = ? WHERE id = ?', keyId, approvalId);
}
