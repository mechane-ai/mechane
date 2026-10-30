import type { CredentialKeyring } from '@mechane/deployment';
import { capturePromise } from '@mechane/utilities';
import { Option, Redacted, Result } from 'effect';
import { Hex } from 'effect/encoding';
import { CREDENTIAL_ALGORITHM } from './constants.ts';
import type { IntegrationSecretInvalid } from './errors.ts';
import { failIntegrationSecret } from './fail-integration-secret.ts';

const CREDENTIAL_KEY_FORMAT = 'raw';

const CREDENTIAL_KEY_BYTES = 32;

type ImportCredentialKeyInput = { readonly keyring: CredentialKeyring; readonly keyVersion: string };

/** A stored key version must name an owned key in the installation's current keyring. */
export async function importCredentialKey({
  keyring,
  keyVersion,
}: ImportCredentialKeyInput): Promise<Result.Result<CryptoKey, IntegrationSecretInvalid>> {
  const { keys } = Redacted.value(keyring);

  if (!Object.hasOwn(keys, keyVersion)) {
    return failIntegrationSecret();
  }

  const key = Option.fromUndefinedOr(keys[keyVersion]);

  if (Option.isNone(key)) {
    return failIntegrationSecret();
  }

  const decoded = Hex.decode(key.value);

  if (Result.isFailure(decoded)) {
    return failIntegrationSecret();
  }

  if (decoded.success.byteLength !== CREDENTIAL_KEY_BYTES) {
    return failIntegrationSecret();
  }

  const bytes = new Uint8Array(decoded.success);

  const pending = crypto.subtle.importKey(CREDENTIAL_KEY_FORMAT, bytes, CREDENTIAL_ALGORITHM, false, [
    'encrypt',
    'decrypt',
  ]);

  const imported = await capturePromise({ promise: pending });

  if (Result.isFailure(imported)) {
    return failIntegrationSecret();
  }

  return Result.succeed(imported.success);
}
