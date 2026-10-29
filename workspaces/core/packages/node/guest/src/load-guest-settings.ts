import { Effect, Schema } from 'effect';
import { GuestMisconfigured } from './errors.ts';
import { GuestEnvironment } from './schemas.ts';
import type { GuestSettings } from './types.ts';

/**
 * Reads the guest's environment once, and its working folder, which is the home every execution starts in; no other
 * module of the guest reads either.
 */
export const loadGuestSettings = Effect.fn('loadGuestSettings')(function* (): Effect.fn.Return<
  GuestSettings,
  GuestMisconfigured
> {
  const variables = yield* Schema.decodeUnknownEffect(GuestEnvironment)(process.env).pipe(
    Effect.mapError((error) => new GuestMisconfigured({ reason: error.message })),
  );

  return { ...variables, home: process.cwd() };
});
