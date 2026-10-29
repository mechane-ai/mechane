import { CREDENTIAL_VARIABLES, Credentials, DeployFailed, DeployStep } from '@mechane/deploy-kernel';
import type { SecretReferences } from '@mechane/deploy-kernel';
import { Effect, Option, Record, Redacted, Schema } from 'effect';
import { readEnvironment } from './read-environment.ts';

type ReadCredentialsInput = {
  /** Absent when credentials come from the declared environment references. */
  readonly path: Option.Option<string>;
  readonly inheritedCredentials: Readonly<Record<string, string>>;
  readonly references: SecretReferences;
};

type RedactCredentialInput = { readonly source: Readonly<Record<string, string>>; readonly name: string };

/** An explicit env file supplies all credentials; without one, only named references are inherited. */
export const readCredentials = Effect.fn('readCredentials')(function* ({
  path,
  inheritedCredentials,
  references,
}: ReadCredentialsInput): Effect.fn.Return<Credentials, DeployFailed> {
  const source = yield* readEnvironment({ path, inheritedCredentials });
  const namedReferences: Readonly<Record<string, string>> = references;
  const cloudflareApiToken = redactCredential({ source, name: CREDENTIAL_VARIABLES.cloudflareApiToken });
  const cloudflareAccountId = redactCredential({ source, name: CREDENTIAL_VARIABLES.cloudflareAccountId });
  const secrets = Record.map(namedReferences, (name) => redactCredential({ source, name }));
  const values = { cloudflareApiToken, cloudflareAccountId, secrets };
  const decoded = Schema.decodeUnknownEffect(Credentials, { errors: 'all' })(values);

  const credentialsInvalid: (error: Schema.SchemaError) => DeployFailed = (error) =>
    new DeployFailed({
      step: DeployStep.DecodeCredentials,
      reason: `${error.message}; check the installation's secret_refs and Cloudflare credentials`,
    });

  return yield* decoded.pipe(Effect.mapError(credentialsInvalid));
});

function redactCredential({ source, name }: RedactCredentialInput): Redacted.Redacted {
  const selected = Record.get(source, name);
  const value = Option.getOrElse(selected, () => '');

  return Redacted.make(value);
}
