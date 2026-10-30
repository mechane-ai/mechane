import { CredentialKeyringVariable } from '@mechane/deployment';
import type { CredentialKeyring } from '@mechane/deployment';
import { Redacted, Result, Schema } from 'effect';
import { OperatorSecretName } from './constants.ts';
import { OperatorSecretUnavailable } from './errors.ts';
import { operatorSecretReader } from './operator-secret-reader.ts';
import type { SecretSource } from './secret-source.schemas.ts';
import type { SecretReader } from './types.ts';

type CredentialKeyringReaderInput = { readonly source: SecretSource };

/** Reads and validates each operation's encryption keyring without retaining a stale key version. */
export function credentialKeyringReader({ source }: CredentialKeyringReaderInput): SecretReader<CredentialKeyring> {
  const name = OperatorSecretName.CredentialKeyring;
  const readSecret = operatorSecretReader({ source, name });

  const read: SecretReader<CredentialKeyring> = async () => {
    const secret = await readSecret();
    const value = Redacted.value(secret);
    const decoded = Schema.decodeUnknownResult(CredentialKeyringVariable)(value);
    const checked = Result.mapError(decoded, () => new OperatorSecretUnavailable({ binding: name }));

    return Result.getOrThrow(checked);
  };

  return read;
}
