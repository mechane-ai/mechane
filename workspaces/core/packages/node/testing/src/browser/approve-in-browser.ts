import type { ApprovalNotice } from '@mechane/program';
import { TYPED_CODE_FIELD } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { Effect } from 'effect';
import { BrowserStep } from '../constants.ts';
import type { BrowserRefused } from '../errors.ts';
import { expectedPage } from './expected-page.ts';
import { signedInBrowser } from './signed-in-browser.ts';
import type { BrowserIdentity } from './types.ts';

type ApproveInBrowserInput = { readonly approval: ApprovalNotice } & BrowserIdentity;

/**
 * Approves a device approval as a person's browser would. It signs in at the local GitHub as `login` on the way to the
 * device page, then types the CLI's code into the page's form. It approves the review the page shows.
 */
export const approveInBrowser = Effect.fn('approveInBrowser')(function* ({
  approval,
  ...identity
}: ApproveInBrowserInput): Effect.fn.Return<void, BrowserRefused> {
  const browser = yield* signedInBrowser({ url: approval.url, ...identity });
  const opened = yield* browser.open({ url: approval.url });
  const form = yield* expectedPage({ step: BrowserStep.ShowCodeForm, page: opened, expected: HttpStatusCode.Ok });
  const typed = yield* browser.submit({ page: form, fields: { [TYPED_CODE_FIELD]: approval.userCode } });
  const review = yield* expectedPage({ step: BrowserStep.ReviewCode, page: typed, expected: HttpStatusCode.Ok });
  const approved = yield* browser.submit({ page: review, fields: {} });

  yield* expectedPage({ step: BrowserStep.Approve, page: approved, expected: HttpStatusCode.Ok });
});
