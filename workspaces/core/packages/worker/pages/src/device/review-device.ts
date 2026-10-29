import { callDirectory } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { ApproveForm, DeviceStep, UserCode, userCodeOf } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import { PendingApproval } from '@mechane/rpc';
import type { Pending } from '@mechane/rpc';
import { escapeHtml } from '@mechane/utilities';
import { DateTime, Duration, Effect, Match, Option, Schema } from 'effect';
import { PageRefusal } from '../constants.ts';
import { PageRefused } from '../errors.ts';
import { hiddenFields } from '../html/hidden-fields.ts';
import { renderPage } from '../html/render-page.ts';
import { csrfToken } from '../session/csrf-token.ts';
import type { BrowserSession, PageFailure } from '../types.ts';
import { PURPOSE_SUMMARY } from './constants.ts';

/** A signed-in browser's review of the code its person typed. */
type ReviewDeviceInput = {
  readonly settings: WorkerSettings;
  readonly session: BrowserSession;
  readonly typedCode: string;
};

/** The pending approval of a reviewed code at `now`, for the session whose CSRF token its approval form carries. */
type ReviewPageInput = {
  readonly approval: Pending;
  readonly userCode: string;
  readonly csrf: string;
  readonly name: string;
  readonly now: DateTime.Utc;
};

/** One line of a review: what it names, and its value before escaping. */
type ReviewRow = { readonly term: string; readonly value: string };

/** What the review of a pending approval tells a person before the button that approves it. */
const APPROVAL_WARNING = 'Approve only a login you started, on a machine you control.';

/** What the review shows for a peer's address or country that the platform did not report. */
const UNREPORTED = 'not reported';

/**
 * Reviews the device approval of the code a signed-in person typed, in any letter case and with or without its hyphen
 * and spaces. Every code that no approval awaits answers one page, whether it expired, was approved or never existed,
 * so a review tells nothing about a code but a pending one.
 */
export const reviewDevice = Effect.fn('reviewDevice')(function* ({
  settings,
  session,
  typedCode,
}: ReviewDeviceInput): Effect.fn.Return<Response, PageFailure> {
  const letters = typedCode.toUpperCase().replaceAll(/[\s-]/g, '');

  const userCode = yield* Schema.decodeUnknownEffect(UserCode)(userCodeOf({ letters })).pipe(
    Effect.mapError(() => new PageRefused({ refusal: PageRefusal.NotPending })),
  );

  const pending = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.pendingDeviceApproval({ userCode }),
    answer: PendingApproval,
  });

  const approval = yield* Match.valueTags(pending, {
    Pending: (found) => Effect.succeed(found),
    NotPending: () => new PageRefused({ refusal: PageRefusal.NotPending }),
  });

  const csrf = yield* csrfToken({ sessionToken: session.token });
  const now = DateTime.nowUnsafe();

  return reviewPage({ approval, userCode, csrf, name: session.name, now });
});

/**
 * What approving issues, for which account, and who asked for it: the key's name and lifetime, the request's age, and
 * its client's address and country. The warning and the one button that approves it follow.
 */
function reviewPage({ approval, userCode, csrf, name, now }: ReviewPageInput): Response {
  const ageSeconds = Math.ceil(Duration.toSeconds(DateTime.distance(approval.createdAt, now)));

  const rows: ReadonlyArray<ReviewRow> = [
    { term: 'Approving will', value: PURPOSE_SUMMARY[approval.purpose] },
    { term: 'Key name', value: approval.keyName },
    { term: 'Key lifetime', value: Duration.format(approval.keyLifetime) },
    { term: 'Account', value: name },
    { term: 'Requested', value: `${Duration.format(Duration.seconds(ageSeconds))} ago` },
    { term: 'From address', value: Option.getOrElse(approval.peerAddress, () => UNREPORTED) },
    { term: 'In country', value: Option.getOrElse(approval.peerCountry, () => UNREPORTED) },
  ];

  const definition: (row: ReviewRow) => string = ({ term, value }) =>
    `<dt>${term}</dt><dd>${escapeHtml({ text: value })}</dd>`;

  const fields = Schema.encodeSync(ApproveForm)({ step: DeviceStep.Approve, userCode, csrfToken: csrf });

  const body = [
    `<p>The code <code>${escapeHtml({ text: userCode })}</code> asks for this:</p>`,
    `<dl>${rows.map(definition).join('')}</dl>`,
    `<p><strong>${APPROVAL_WARNING}</strong></p>`,
    `<form method="post">${hiddenFields({ fields })}<button type="submit">Approve</button></form>`,
  ].join('\n');

  return renderPage({ status: HttpStatusCode.Ok, title: 'Review this request', body, headers: [] });
}
