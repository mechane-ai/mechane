import { Effect, Redacted } from 'effect';
import { PageRefusal } from '../constants.ts';
import { PageRefused } from '../errors.ts';

type MatchesBootstrapSecretInput = { readonly expected: Redacted.Redacted; readonly submitted: Redacted.Redacted };

/** WebCrypto verifies the signature without a secret-dependent string comparison. */
export const matchesBootstrapSecret = Effect.fn('matchesBootstrapSecret')(function* ({
  expected,
  submitted,
}: MatchesBootstrapSecretInput): Effect.fn.Return<boolean, PageRefused> {
  const encoder = new TextEncoder();
  const expectedValue = Redacted.value(expected);
  const submittedValue = Redacted.value(submitted);
  const expectedBytes = encoder.encode(expectedValue);
  const submittedBytes = encoder.encode(submittedValue);

  const key = yield* Effect.tryPromise({
    try: () =>
      crypto.subtle.importKey('raw', expectedBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']),
    catch: () => new PageRefused({ refusal: PageRefusal.BootstrapRefused }),
  });

  const signature = yield* Effect.tryPromise({
    try: () => crypto.subtle.sign('HMAC', key, expectedBytes),
    catch: () => new PageRefused({ refusal: PageRefusal.BootstrapRefused }),
  });

  return yield* Effect.tryPromise({
    try: () => crypto.subtle.verify('HMAC', key, signature, submittedBytes),
    catch: () => new PageRefused({ refusal: PageRefusal.BootstrapRefused }),
  });
});
