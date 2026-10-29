import type { DirectoryStore, PrincipalRow } from '@mechane/directory-store';
import { writeLog } from '@mechane/logs';
import { LogEvent } from '@mechane/protocol';
import type { BrowserIdentity } from '@mechane/records';
import { ApprovalDecision } from '@mechane/rpc';
import type { ApproveDeviceApprovalInput } from '@mechane/rpc';
import { Option } from 'effect';
import type { DateTime } from 'effect';

/** A browser session's approval of a device approval, decided against the directory's store at the call's instant. */
type DecideApprovalInput = {
  readonly store: DirectoryStore;
  readonly userCode: ApproveDeviceApprovalInput['userCode'];
  readonly sessionTokenHash: ApproveDeviceApprovalInput['sessionTokenHash'];
  readonly dailyAllowanceMicros: ApproveDeviceApprovalInput['dailyAllowanceMicros'];
  readonly now: DateTime.Utc;
};

/** A live browser session signing in, and the allowance of the workspace a first sign-in creates. */
type SignedInPrincipalInput = {
  readonly store: DirectoryStore;
  readonly session: BrowserIdentity;
  readonly dailyAllowanceMicros: number;
  readonly now: DateTime.Utc;
};

/** The first approval by an identity creates its principal and personal workspace in the same transaction. */
export function decideApproval({
  store,
  userCode,
  sessionTokenHash,
  dailyAllowanceMicros,
  now,
}: DecideApprovalInput): typeof ApprovalDecision.Encoded {
  const approve: () => typeof ApprovalDecision.Encoded = () => {
    const session = store.liveBrowserSession({ tokenHash: sessionTokenHash, now });
    const pending = store.pendingDeviceApproval({ userCode, now });

    if (Option.isNone(session)) {
      return ApprovalDecision.cases.SignedOut.make({});
    }

    if (Option.isNone(pending)) {
      return ApprovalDecision.cases.NotPending.make({});
    }

    const principal = signedInPrincipal({ store, session: session.value, dailyAllowanceMicros, now });
    const { id, purpose, keyName } = pending.value;

    store.recordApproval({ approvalId: id, principalId: principal.id });

    return ApprovalDecision.cases.Approved.make({ purpose, keyName, principal });
  };

  return store.atomic({ run: approve });
}

/** An identity's provider and subject establish ownership; its name only labels new records. */
function signedInPrincipal({ store, session, dailyAllowanceMicros, now }: SignedInPrincipalInput): PrincipalRow {
  const identity = { provider: session.provider, subject: session.subject };
  const existing = store.principalForIdentity({ identity });

  if (Option.isSome(existing)) {
    return existing.value;
  }

  const principal = { id: crypto.randomUUID(), name: session.name };
  const workspace = { id: crypto.randomUUID(), name: session.name, dailyAllowanceMicros };

  store.signUp({ principal, identity, workspace, now });
  writeLog({
    line: {
      event: LogEvent.IdentitySignedUp,
      principalId: principal.id,
      workspaceId: workspace.id,
      provider: session.provider,
    },
  });

  return principal;
}
