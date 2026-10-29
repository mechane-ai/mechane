import { Duration } from 'effect';

/** The cookies of the pages: the browser session, and the sign-in that GitHub returns the browser to. */
export const CookieName = { Session: 'mechane_session', SignIn: 'mechane_sign_in' } as const;

export type CookieName = (typeof CookieName)[keyof typeof CookieName];

/** How long each cookie and the record behind it live. */
export const COOKIE_LIFETIME = {
  [CookieName.Session]: Duration.hours(1),
  [CookieName.SignIn]: Duration.minutes(10),
} as const;

/** The `cache-control` of every page and redirect: no cache keeps one, so none keeps a code, a state or a cookie. */
export const NO_STORE = 'no-store';

/** Why a page refused a browser's request, which names the page it answers with. */
export const PageRefusal = {
  SignInInvalid: 'sign_in_invalid',
  SignInDenied: 'sign_in_denied',
  NotPending: 'not_pending',
  SignedOut: 'signed_out',
  ForgedForm: 'forged_form',
  SignInUnavailable: 'sign_in_unavailable',
  BootstrapRefused: 'bootstrap_refused',
} as const;

export type PageRefusal = (typeof PageRefusal)[keyof typeof PageRefusal];

/** The calls a sign-in makes to GitHub: exchanging the authorization code, then reading the user it signs in. */
export const GitHubStep = { ExchangeCode: 'exchange_code', ReadUser: 'read_user' } as const;

export type GitHubStep = (typeof GitHubStep)[keyof typeof GitHubStep];
