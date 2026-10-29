import type { ApprovalNotice } from '@mechane/program';
import { ApproveForm, bearerAuthorization, DeviceStep } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { Effect, Schema } from 'effect';
import { BrowserStep } from '../constants.ts';
import { BrowserRefused } from '../errors.ts';
import { FORGED_CSRF_TOKEN } from './constants.ts';
import { sentPage } from './sent-page.ts';

type PresentKeyInput = { readonly approval: ApprovalNotice; readonly token: string };

/**
 * Posts an approval with a key, as a client without a browser session would. The approval is a well-formed one of the
 * CLI's code, from the page's origin, so only the missing session can refuse it. It fails if the page approves.
 */
export const presentKey = Effect.fn('presentKey')(function* ({
  approval,
  token,
}: PresentKeyInput): Effect.fn.Return<void, BrowserRefused> {
  const form = Schema.encodeSync(ApproveForm)({
    step: DeviceStep.Approve,
    userCode: approval.userCode,
    csrfToken: FORGED_CSRF_TOKEN,
  });

  const request = new Request(approval.url, {
    method: HttpMethod.Post,
    headers: { [HttpHeader.Authorization]: bearerAuthorization({ token }), [HttpHeader.Origin]: approval.url.origin },
    body: new URLSearchParams(form),
  });

  const answer = yield* sentPage({ step: BrowserStep.ApproveWithKey, request });

  if (answer.status === HttpStatusCode.Ok) {
    return yield* new BrowserRefused({
      step: BrowserStep.ApproveWithKey,
      url: approval.url,
      reason: 'the page approved for a key, without a browser session',
    });
  }
});
