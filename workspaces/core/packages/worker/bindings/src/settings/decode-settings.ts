import { KeyPurpose, WorkerMisconfigured } from '@mechane/protocol';
import { credentialKeyringReader, objectBindings, OperatorSecretName, operatorSecretReader } from '@mechane/rpc';
import type { DecodeSettingsInput, SecretReader, SecretSource } from '@mechane/rpc';
import { Duration, Effect, Option, Schema } from 'effect';
import type { Redacted } from 'effect';
import { WorkerVariables } from '../schemas.ts';
import type { WorkerSettings } from '../types.ts';
import { releaseFileReader } from './release-file-reader.ts';
import { validateAuthenticationSettings } from './validate-authentication-settings.ts';

/** Decodes the runtime's environment; it is the only code that reads a binding or a variable. */
export const decodeSettings = Effect.fn('decodeSettings')(function* ({
  environment,
}: DecodeSettingsInput): Effect.fn.Return<WorkerSettings, WorkerMisconfigured> {
  const { loginKeyLifetimeSeconds, namedKeyLifetimeSeconds, ...variables } = yield* Schema.decodeUnknownEffect(
    WorkerVariables,
  )(environment).pipe(Effect.mapError(() => new WorkerMisconfigured({ reason: 'worker settings are invalid' })));

  yield* validateAuthenticationSettings({ variables });

  const releasesBucket = Option.fromNullishOr(environment.RELEASES);
  const readReleaseFile = yield* releaseFileReader({ origin: variables.releaseOrigin, bucket: releasesBucket });

  const githubSecretReader: (source: SecretSource) => SecretReader<Redacted.Redacted> = (source) =>
    operatorSecretReader({ source, name: OperatorSecretName.GitHub });

  return {
    ...variables,
    githubClientSecret: Option.map(variables.githubClientSecret, githubSecretReader),
    credentialKeyring: credentialKeyringReader({ source: variables.credentialKeyring }),
    keyLifetimes: {
      [KeyPurpose.Login]: Duration.seconds(loginKeyLifetimeSeconds),
      [KeyPurpose.Named]: Duration.seconds(namedKeyLifetimeSeconds),
    },
    ...objectBindings({ environment }),
    readReleaseFile,
  };
});
