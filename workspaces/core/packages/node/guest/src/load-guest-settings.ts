import { Effect, Option, Schema } from 'effect';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { validateTrustedCertificates } from './certificate-environment.ts';
import { GuestMisconfigured } from './errors.ts';
import { GuestEnvironment } from './schemas.ts';
import type { GuestSettings } from './types.ts';

const [, entry, mode] = process.argv;
export const guestCommand = { entry: Option.fromNullishOr(entry), mode } as const;

type LoadGuestSettingsInput = { readonly scratchDirectory: string };

/**
 * Reads the guest's environment once, and its working folder, which is the home every execution starts in; no other
 * module of the guest reads either.
 */
export const loadGuestSettings = Effect.fn('loadGuestSettings')(function* ({
  scratchDirectory,
}: LoadGuestSettingsInput): Effect.fn.Return<GuestSettings, GuestMisconfigured> {
  const variables = yield* Schema.decodeUnknownEffect(GuestEnvironment)(process.env).pipe(
    Effect.mapError((error) => new GuestMisconfigured({ reason: error.message })),
  );

  yield* validateTrustedCertificates(variables);

  const home = process.cwd();
  const homeKey = createHash('sha256').update(home).digest('hex');
  const temporary = dirname(scratchDirectory);
  const toolCacheDirectory = join(temporary, `mechane-tools-${homeKey}`);

  return {
    ...variables,
    home,
    toolTarget: `${process.platform}-${process.arch}`,
    scratchDirectory,
    toolCacheDirectory,
  };
});
