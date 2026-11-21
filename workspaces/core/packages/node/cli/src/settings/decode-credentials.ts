import { ApiKeyInvalid, UsageInvalid } from '@mechane/cli-kernel';
import type { CredentialSettings } from '@mechane/cli-kernel';
import type { OutputMode } from '@mechane/commands';
import { KeyToken } from '@mechane/protocol';
import { Effect, Option, Schema } from 'effect';
import { isAbsolute, join } from 'node:path';

type DecodeCredentialsInput = {
  /** None when the API key variable is unset. */
  readonly apiKey: Option.Option<string>;
  /** None when the XDG configuration variable is unset. */
  readonly configHome: Option.Option<string>;
  readonly home: string;
  readonly output: OutputMode;
};

/** The folder below the home folder that holds user configuration when the XDG variable names none. */
const CONFIG_HOME_FALLBACK = '.config';

type ConfigurationRootInput = {
  /** None when the XDG configuration variable is unset. */
  readonly configHome: Option.Option<string>;
  readonly home: string;
};

/**
 * Where the saved login lives, and the key that replaces it when the API key variable holds one; the variable's value
 * never reaches a message, since it is a secret.
 */
export const decodeCredentials = Effect.fn('decodeCredentials')(function* ({
  apiKey,
  configHome,
  home,
  output,
}: DecodeCredentialsInput): Effect.fn.Return<CredentialSettings, UsageInvalid> {
  const root = configurationRoot({ configHome, home });

  if (Option.isNone(apiKey)) {
    return { apiKey: Option.none(), configurationRoot: root };
  }

  const keyInvalid: () => UsageInvalid = () => new UsageInvalid({ problem: new ApiKeyInvalid(), output });
  const token = yield* Schema.decodeUnknownEffect(KeyToken)(apiKey.value).pipe(Effect.mapError(keyInvalid));

  return { apiKey: Option.some(token), configurationRoot: root };
});

/** The XDG configuration folder, which must be absolute, or else the conventional folder in the home folder. */
function configurationRoot({ configHome, home }: ConfigurationRootInput): string {
  const absolute = Option.filter(configHome, isAbsolute);

  return Option.getOrElse(absolute, () => join(home, CONFIG_HOME_FALLBACK));
}
