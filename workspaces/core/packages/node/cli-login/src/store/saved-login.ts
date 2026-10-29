import { CredentialsFailed, CredentialsStep } from '@mechane/cli-kernel';
import { readOptionalFile } from '@mechane/program';
import { Effect, Option, Schema } from 'effect';
import type { SavedLogin } from '../schemas.ts';
import { credentialsPath } from './credentials-path.ts';
import { SavedLoginJson } from './schemas.ts';
import type { ConfigurationRootInput } from './types.ts';

/** Why a saved login does not decode, in place of the decoder's text, which could quote its key. */
const UNDECODED_LOGIN = 'it holds no saved login; sign in again';

/** The saved login, none when no login was saved; a file that does not decode fails without quoting its text. */
export const savedLogin = Effect.fn('savedLogin')(function* ({
  configurationRoot,
}: ConfigurationRootInput): Effect.fn.Return<Option.Option<SavedLogin>, CredentialsFailed> {
  const path = credentialsPath({ configurationRoot });

  const text = yield* readOptionalFile({ path }).pipe(
    Effect.mapError(({ reason }) => new CredentialsFailed({ step: CredentialsStep.Read, path, reason })),
  );

  if (Option.isNone(text)) {
    return Option.none();
  }

  const undecoded: () => CredentialsFailed = () =>
    new CredentialsFailed({ step: CredentialsStep.Decode, path, reason: UNDECODED_LOGIN });

  const saved = yield* Schema.decodeUnknownEffect(SavedLoginJson)(text.value).pipe(Effect.mapError(undecoded));

  return Option.some(saved);
});
