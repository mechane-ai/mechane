import { KeyExpired, KeyMissing, KeyRevoked, KeyUnrecognized } from './errors.ts';

/** The failures of admission's key: the request carries none, or one the directory does not accept. */
export const AUTHENTICATION_FAILURES = [KeyMissing, KeyUnrecognized, KeyRevoked, KeyExpired] as const;

/** A failure of admission's key: the request carries none, or one the directory does not accept. */
export type AuthenticationFailure = (typeof AUTHENTICATION_FAILURES)[number]['Type'];
