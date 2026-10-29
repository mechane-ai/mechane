import type { CredentialsFailed } from '@mechane/cli-kernel';
import { SavedLoginMissing } from '@mechane/cli-kernel';
import { Effect, Option } from 'effect';
import type { SavedLogin } from './schemas.ts';
import { savedLogin } from './store/saved-login.ts';

type SavedCredentialInput = { readonly origin: URL; readonly configurationRoot: string };

/** The saved login, which a command sends only to the origin that issued it. */
export const savedCredential = Effect.fn('savedCredential')(function* ({
  origin,
  configurationRoot,
}: SavedCredentialInput): Effect.fn.Return<SavedLogin, SavedLoginMissing | CredentialsFailed> {
  const saved = yield* savedLogin({ configurationRoot });
  const issued = Option.filter(saved, (login) => login.origin === origin.origin);

  if (Option.isNone(issued)) {
    return yield* new SavedLoginMissing({
      origin: origin.origin,
      savedOrigin: Option.map(saved, (login) => login.origin),
    });
  }

  return issued.value;
});
