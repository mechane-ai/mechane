import { InputInvalid, UsageInvalid } from '@mechane/cli-kernel';
import type { CredentialSettings } from '@mechane/cli-kernel';
import type { OutputMode } from '@mechane/commands';
import { Effect, Option, Redacted } from 'effect';

type SelfCredentialsInput = {
  readonly command: string;
  readonly token: Option.Option<string>;
  readonly credentials: CredentialSettings;
  readonly output: OutputMode;
};

export const decodeSelfCredentials = Effect.fn('decodeSelfCredentials')(function* ({
  command,
  token,
  credentials,
  output,
}: SelfCredentialsInput): Effect.fn.Return<CredentialSettings, UsageInvalid> {
  if (Option.isNone(token) || token.value.length === 0) {
    const problem = new InputInvalid({
      command,
      reason: 'MECHANE_SELF_TOKEN is required for commands scoped to the current mech',
    });

    return yield* new UsageInvalid({ problem, output });
  }

  const selfToken = Redacted.make(token.value);

  return { apiKey: Option.none(), configurationRoot: credentials.configurationRoot, selfToken: Option.some(selfToken) };
});
