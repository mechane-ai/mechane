import { callDirectory } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { tokenHash } from '@mechane/credentials';
import { HttpStatusCode } from '@mechane/records';
import { ApprovalDecision } from '@mechane/rpc';
import type { Approved } from '@mechane/rpc';
import { escapeHtml } from '@mechane/utilities';
import { Effect, Match } from 'effect';
import { PageRefusal } from '../constants.ts';
import { PageRefused } from '../errors.ts';
import { renderPage } from '../html/render-page.ts';
import { requireIdentityAdmission } from '../session/require-identity-admission.ts';
import type { BrowserSession, PageFailure } from '../types.ts';
import { PURPOSE_SUMMARY } from './constants.ts';

/** A signed-in browser's approval of the code its review showed. */
type ApproveDeviceInput = {
  readonly settings: WorkerSettings;
  readonly session: BrowserSession;
  readonly userCode: string;
};

type ApprovedPageInput = { readonly approved: Approved };

/**
 * Approves the device approval a review showed, as the browser session's GitHub user. The directory signs a new GitHub
 * user up as it approves, and refuses once the session or the approval is gone.
 */
export const approveDevice = Effect.fn('approveDevice')(function* ({
  settings,
  session,
  userCode,
}: ApproveDeviceInput): Effect.fn.Return<Response, PageFailure> {
  yield* requireIdentityAdmission({ settings, identity: session });

  const sessionTokenHash = yield* tokenHash({ token: session.token });

  const decision = yield* callDirectory({
    settings,
    call: ({ directory }) =>
      directory.approveDeviceApproval({
        userCode,
        sessionTokenHash,
        dailyAllowanceMicros: settings.dailyAllowanceMicros,
      }),
    answer: ApprovalDecision,
  });

  const approved = yield* Match.valueTags(decision, {
    Approved: (answer) => Effect.succeed(answer),
    SignedOut: () => new PageRefused({ refusal: PageRefusal.SignedOut }),
    NotPending: () => new PageRefused({ refusal: PageRefusal.NotPending }),
  });

  return approvedPage({ approved });
});

/** The page of an approval: what it approved, for which key and principal, and that the terminal finishes alone. */
function approvedPage({ approved }: ApprovedPageInput): Response {
  const keyName = escapeHtml({ text: approved.keyName });
  const principalName = escapeHtml({ text: approved.principal.name });

  const body = [
    `<p>You approved this request to ${PURPOSE_SUMMARY[approved.purpose]}, for the key`,
    `<strong>${keyName}</strong> of ${principalName}.</p>`,
    '<p>Return to your terminal; the command finishes on its own.</p>',
  ].join('\n');

  return renderPage({ status: HttpStatusCode.Ok, title: 'Approved', body, headers: [] });
}
