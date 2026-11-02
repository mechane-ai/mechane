import { Duration } from 'effect';

/** The cookies of the pages: the browser session, and the sign-in that GitHub returns the browser to. */
export const CookieName = {
  Session: 'mechane_session',
  SignIn: 'mechane_sign_in',
  Destination: 'mechane_destination',
} as const;

export type CookieName = (typeof CookieName)[keyof typeof CookieName];

/** How long each cookie and the record behind it live. */
export const COOKIE_LIFETIME = {
  [CookieName.Session]: Duration.hours(1),
  [CookieName.SignIn]: Duration.minutes(10),
  [CookieName.Destination]: Duration.minutes(10),
} as const;
