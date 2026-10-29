import { sha256Hex } from '@mechane/utilities';
import { Effect } from 'effect';

/** A secret token, such as a key, a poll token or a session token. */
type TokenHashInput = { readonly token: string };

/** The SHA-256 digest of a token as hex, the only form in which the directory stores or looks up a token. */
export const tokenHash = Effect.fn('tokenHash')(function* ({ token }: TokenHashInput): Effect.fn.Return<string> {
  return yield* Effect.promise(() => sha256Hex({ text: token }));
});
