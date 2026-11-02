import type { DirectoryStore } from '@mechane/directory-store';
import { Micros } from '@mechane/records';
import { ApprovalDecision } from '@mechane/rpc';
import type { ApproveDeviceApprovalInput } from '@mechane/rpc';
import { Option } from 'effect';
import type { DateTime } from 'effect';
import { signedInPrincipal } from '../identities/signed-in-principal.ts';

/** A browser session's approval of a device approval, decided against the directory's store at the call's instant. */
type DecideApprovalInput = {
  readonly store: DirectoryStore;
  readonly userCode: ApproveDeviceApprovalInput['userCode'];
  readonly sessionTokenHash: ApproveDeviceApprovalInput['sessionTokenHash'];
  readonly dailyAllowanceMicros: ApproveDeviceApprovalInput['dailyAllowanceMicros'];
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

    const allowance = Micros.make(dailyAllowanceMicros);
    const principal = signedInPrincipal({ store, session: session.value, dailyAllowanceMicros: allowance, now });
    const { id, purpose, keyName } = pending.value;

    store.recordApproval({ approvalId: id, principalId: principal.id });

    return ApprovalDecision.cases.Approved.make({ purpose, keyName, principal });
  };

  return store.atomic({ run: approve });
}
