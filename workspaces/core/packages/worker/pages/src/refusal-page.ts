import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { escapeHtml } from '@mechane/utilities';
import { Match } from 'effect';
import { GitHubStep, PageRefusal } from './constants.ts';
import { renderPage } from './html/render-page.ts';
import type { PageFailure, PageHeader } from './types.ts';

/**
 * What a failure's page shows, its status, title and the detail of what the person can do next, and the headers it
 * answers with beside the pages' own.
 */
type FailurePage = {
  readonly status: HttpStatusCode;
  readonly title: string;
  readonly detail: string;
  readonly headers: ReadonlyArray<PageHeader>;
};

/** The page of each failure, by its tag. */
type FailurePages = {
  readonly [T in PageFailure['_tag']]: (failure: Extract<PageFailure, Readonly<Record<'_tag', T>>>) => FailurePage;
};

type RefusalPageInput = { readonly failure: PageFailure };

/**
 * What each refusal's page shows. Every typed code that no device approval awaits answers one page, whether it expired,
 * was approved or never existed. A review so tells a person nothing about a code they did not start.
 */
const REFUSALS: Readonly<Record<PageRefusal, FailurePage>> = {
  [PageRefusal.SignInUnavailable]: {
    status: HttpStatusCode.Forbidden,
    title: 'This sign-in is unavailable',
    detail: 'Open the device page on the configured deployment origin',
    headers: [],
  },
  [PageRefusal.BootstrapRefused]: {
    status: HttpStatusCode.Forbidden,
    title: 'The local secret was refused',
    detail: 'Use the bootstrap secret file printed by the local server',
    headers: [],
  },
  [PageRefusal.SignInInvalid]: {
    status: HttpStatusCode.BadRequest,
    title: 'The GitHub sign-in did not finish',
    detail: 'It expired, or it began in another browser; open the URL your terminal printed again',
    headers: [],
  },
  [PageRefusal.SignInDenied]: {
    status: HttpStatusCode.Forbidden,
    title: 'GitHub did not sign you in',
    detail: 'The sign-in was declined at GitHub; to approve, open the URL your terminal printed again',
    headers: [],
  },
  [PageRefusal.NotPending]: {
    status: HttpStatusCode.NotFound,
    title: 'No login awaits this code',
    detail: 'Check the code your terminal shows and type it again, or run the command in your terminal again',
    headers: [],
  },
  [PageRefusal.SignedOut]: {
    status: HttpStatusCode.Forbidden,
    title: 'Sign in again',
    detail: 'This browser is not signed in to approve; open the URL your terminal printed again',
    headers: [],
  },
  [PageRefusal.ForgedForm]: {
    status: HttpStatusCode.Forbidden,
    title: 'This form did not come from its page',
    detail: 'Open the URL your terminal printed and type the code on the page it shows',
    headers: [],
  },
};

/** The call to GitHub each step names, as a failure's page tells it. */
const GITHUB_STEPS: Readonly<Record<GitHubStep, string>> = {
  [GitHubStep.ExchangeCode]: 'exchange the authorization code with GitHub',
  [GitHubStep.ReadUser]: 'read the signed-in user from GitHub',
};

/** The page of each failure; a rate limit's page also names its wait in `retry-after`. */
const FAILURE_PAGES: Readonly<FailurePages> = {
  PageRefused: ({ refusal }) => REFUSALS[refusal],
  RateLimited: ({ retryAfterSeconds }) => ({
    status: HttpStatusCode.TooManyRequests,
    title: 'Too many requests',
    detail: `This address or account sent more than it may for now; try again in ${retryAfterSeconds} seconds`,
    headers: [[HttpHeader.RetryAfter, String(retryAfterSeconds)]],
  }),
  ObjectUnavailable: ({ objectClass, reason }) => ({
    status: HttpStatusCode.Unavailable,
    title: 'Mechane is unavailable',
    detail: `call ${objectClass}: ${reason}; reload the page in a moment`,
    headers: [],
  }),
  GitHubUnavailable: ({ step, reason }) => ({
    status: HttpStatusCode.BadGateway,
    title: 'GitHub did not answer',
    detail: `${GITHUB_STEPS[step]}: ${reason}; open the URL your terminal printed again in a moment`,
    headers: [],
  }),
  GitHubRefused: ({ reason }) => ({
    status: HttpStatusCode.BadRequest,
    title: 'GitHub refused the sign-in',
    detail: `exchange the authorization code: ${reason}; open the URL your terminal printed again`,
    headers: [],
  }),
};

/** The page that answers a page's failure: what went wrong, why, and what the person can do next. */
export function refusalPage({ failure }: RefusalPageInput): Response {
  const { status, title, detail, headers } = Match.valueTags(failure, FAILURE_PAGES);
  const body = `<p>${escapeHtml({ text: detail })}</p>`;

  return renderPage({ status, title, body, headers });
}
