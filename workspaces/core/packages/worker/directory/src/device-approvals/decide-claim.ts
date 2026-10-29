import type { DeviceApprovalRow, DirectoryStore, PrincipalRow } from '@mechane/directory-store';
import { writeLog } from '@mechane/logs';
import { LogEvent } from '@mechane/protocol';
import { ApprovalClaim } from '@mechane/rpc';
import type { ClaimDeviceApprovalInput } from '@mechane/rpc';
import { DateTime, Option } from 'effect';

/** A poll's claim of a device approval, decided against the directory's store at the call's instant. */
type DecideClaimInput = {
  readonly store: DirectoryStore;
  readonly pollTokenHash: ClaimDeviceApprovalInput['pollTokenHash'];
  readonly keyId: ClaimDeviceApprovalInput['keyId'];
  readonly keyTokenHash: ClaimDeviceApprovalInput['keyTokenHash'];
  readonly now: DateTime.Utc;
};

/** An approved device approval whose key a poll claims, under the id and token hash the poll made. */
type IssueClaimedKeyInput = {
  readonly store: DirectoryStore;
  readonly approval: DeviceApprovalRow;
  readonly principalId: PrincipalRow['id'];
  readonly keyId: ClaimDeviceApprovalInput['keyId'];
  readonly keyTokenHash: ClaimDeviceApprovalInput['keyTokenHash'];
  readonly now: DateTime.Utc;
};

/**
 * Claims an approved device approval: mints its key through the one issuance path and records the claim in one
 * transaction. A token reaches exactly one poll, and its raw value is never stored.
 */
export function decideClaim({
  store,
  pollTokenHash,
  keyId,
  keyTokenHash,
  now,
}: DecideClaimInput): typeof ApprovalClaim.Encoded {
  const claim: () => typeof ApprovalClaim.Encoded = () => {
    const found = store.claimableDeviceApproval({ pollTokenHash, now });

    if (Option.isNone(found)) {
      return ApprovalClaim.cases.Unclaimable.make({});
    }

    const approval = found.value;

    if (Option.isNone(approval.approverId)) {
      return ApprovalClaim.cases.Pending.make({});
    }

    return issueClaimedKey({ store, approval, principalId: approval.approverId.value, keyId, keyTokenHash, now });
  };

  return store.atomic({ run: claim });
}

/** Issues the approval's key to its approver for the approval's key lifetime, and records the claim. */
function issueClaimedKey({
  store,
  approval,
  principalId,
  keyId,
  keyTokenHash,
  now,
}: IssueClaimedKeyInput): typeof ApprovalClaim.Encoded {
  const { id, keyName, purpose, keyLifetime } = approval;

  const issued = {
    id: keyId,
    principalId,
    name: keyName,
    purpose,
    createdAtMs: DateTime.toEpochMillis(now),
    expiresAtMs: DateTime.toEpochMillis(DateTime.addDuration(now, keyLifetime)),
    revokedAtMs: null,
  };

  store.issueKey({ key: { ...issued, tokenHash: keyTokenHash } });
  store.recordClaim({ approvalId: id, keyId });
  writeLog({ line: { event: LogEvent.KeyIssued, keyId, principalId, purpose } });

  return { _tag: 'Claimed', key: issued, principal: store.principal({ principalId }) };
}
