import { Schema } from 'effect';
import { OriginProtocol } from './constants.ts';

/** The stable public artifact base; each download selects a versioned directory beneath it. */
export const ReleaseOrigin = Schema.URLFromString.check(
  Schema.makeFilter((url) => url.protocol === OriginProtocol.Secure, { expected: 'an HTTPS artifact base' }),
  Schema.makeFilter((url) => url.username === '' && url.password === '', {
    expected: 'an artifact base without credentials',
  }),
  Schema.makeFilter((url) => url.search === '' && url.hash === '', {
    expected: 'an artifact base without query or fragment',
  }),
);

export type ReleaseOrigin = typeof ReleaseOrigin.Type;
