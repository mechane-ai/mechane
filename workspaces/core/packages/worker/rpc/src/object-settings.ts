import { WorkerMisconfigured } from '@mechane/protocol';
import { Result, Schema } from 'effect';
import { objectBindings } from './object-bindings.ts';
import { MechVariables } from './schemas.ts';
import { OperatorSecretName } from './secrets/constants.ts';
import { credentialKeyringReader } from './secrets/credential-keyring-reader.ts';
import { operatorSecretReader } from './secrets/operator-secret-reader.ts';
import type { DecodeSettingsInput, ObjectSettings } from './types.ts';

/**
 * Decodes the environment a mech's object receives, once, as the object opens; variables that do not decode fail the
 * open, which the object's fallback alarm retries.
 */
export function objectSettings({ environment }: DecodeSettingsInput): ObjectSettings {
  const decoded = Schema.decodeUnknownResult(MechVariables)(environment);
  const checked = Result.mapError(decoded, () => new WorkerMisconfigured({ reason: 'mech settings are invalid' }));
  const { modelApiKey, credentialKeyring, ...variables } = Result.getOrThrow(checked);

  return {
    ...variables,
    modelApiKey: operatorSecretReader({ source: modelApiKey, name: OperatorSecretName.Model }),
    credentialKeyring: credentialKeyringReader({ source: credentialKeyring }),
    ...objectBindings({ environment }),
  };
}
