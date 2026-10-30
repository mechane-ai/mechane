import type { CredentialKeyring } from '@mechane/deployment';
import { Redacted } from 'effect';
import { randomBytes } from 'node:crypto';
import { SECRET_BYTES } from '../../constants.ts';

const INITIAL_KEY_VERSION = 'v1';

type GeneratedCredentialKeyring = { readonly keyring: CredentialKeyring; readonly encoded: string };

/** Generates an independent encryption key and the JSON value staged for one local installation. */
export function generateCredentialKeyring(): GeneratedCredentialKeyring {
  const key = randomBytes(SECRET_BYTES).toString('hex');
  const contents = { current: INITIAL_KEY_VERSION, keys: { [INITIAL_KEY_VERSION]: key } };

  return { keyring: Redacted.make(contents), encoded: JSON.stringify(contents) };
}
