import { Delivery } from '@mechane/protocol';
import { InboxItemId } from '@mechane/records';
import { Effect } from 'effect';
import { githubSignInResult } from '../browser/github-sign-in-result.ts';
import { refusedCli } from '../cli/refused-cli.ts';
import { refusedOperation } from '../cli/refused-operation.ts';
import type { ScenarioFailure, StackInput } from '../types.ts';
import type { PrivateAdmissionFixture } from './types.ts';

type RefusePrivateAdmissionInput = StackInput & { readonly subject: PrivateAdmissionFixture };

type PrivateAdmissionRefusals = {
  readonly approvalStatus: number;
  readonly signInStatus: number;
  readonly cliCode: string;
  readonly memberCode: string;
};

/** Browser, CLI, and direct API requests independently exercise revoked identity admission. */
export const refusePrivateAdmission = Effect.fn('refusePrivateAdmission')(function* ({
  stack,
  subject,
}: RefusePrivateAdmissionInput): Effect.fn.Return<PrivateAdmissionRefusals, ScenarioFailure> {
  const approvalRefused = yield* subject.approvalAttempt;
  const signInRefused = yield* githubSignInResult({ url: subject.approvalUrl, login: subject.pendingLogin });
  const args = ['inbox', 'send', subject.mech.id, 'This request must never reach the model'];
  const refused = yield* refusedCli({ stack, args, environment: subject.mech.account.environment });
  const inboxItemId = InboxItemId.make(crypto.randomUUID());

  const input = {
    workspaceId: subject.workspaceId,
    mechId: subject.mech.id,
    inboxItemId,
    delivery: Delivery.WhenIdle,
    text: 'This direct request must never reach the model',
  };

  const credential = subject.credential;
  const memberCode = yield* refusedOperation({ stack, name: 'sendInboxItem', credential, input });

  return {
    approvalStatus: approvalRefused.status,
    signInStatus: signInRefused.returned.status,
    cliCode: refused.code,
    memberCode,
  };
});
