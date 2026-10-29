import { ApprovalTimedOut, VerificationUrlMismatched } from '@mechane/cli-kernel';
import type { RunFailure } from '@mechane/cli-kernel';
import type { OperationCall } from '@mechane/client';
import { PROGRAM } from '@mechane/commands';
import { writeDiagnostic } from '@mechane/program';
import type { ApprovedPoll, KeyPurpose } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import { awaitApproval } from './await-approval.ts';
import type { ApprovalOperation } from './types.ts';

type ApproveDeviceInput = {
  readonly call: OperationCall<ApprovalOperation>;
  /** The CLI's origin, which the approval page must be on. */
  readonly origin: URL;
  readonly purpose: KeyPurpose;
  /** The key's name, which the approval page shows. */
  readonly name: string;
};

/**
 * Starts a device approval, tells the person where to approve it, and polls until a browser approved it and the poll
 * claimed its key. The approval page must be on the CLI's own origin, so a deployment cannot send a person elsewhere.
 */
export const approveDevice = Effect.fn('approveDevice')(function* ({
  call,
  origin,
  purpose,
  name,
}: ApproveDeviceInput): Effect.fn.Return<ApprovedPoll, RunFailure> {
  const started = yield* call({ name: 'startDeviceApproval', input: { purpose, name }, credential: Option.none() });
  const { userCode, verificationUrl, pollToken, interval, expiresIn } = started;
  const late = new ApprovalTimedOut({ userCode, timeout: expiresIn });

  if (verificationUrl.origin !== origin.origin) {
    return yield* new VerificationUrlMismatched({ url: verificationUrl });
  }

  writeDiagnostic({ program: PROGRAM, line: `open ${verificationUrl.href}, sign in, and type the code ${userCode}` });

  return yield* awaitApproval({ call, pollToken, interval }).pipe(
    Effect.timeoutOrElse({ duration: expiresIn, orElse: () => Effect.fail(late) }),
  );
});
