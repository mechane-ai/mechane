import { CredentialKeyringVariable } from '@mechane/deployment';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { StackFailed } from '../../errors.ts';
import { generateCredentialKeyring } from './generate-credential-keyring.ts';
import { localSecretFile } from './local-secret-file.ts';

type LocalCredentialKeyringInput = { readonly path: string };

/** The key survives runtime restarts and never enters an object database. */
export const localCredentialKeyring = Effect.fn('localCredentialKeyring')(function* ({
  path,
}: LocalCredentialKeyringInput): Effect.fn.Return<string, StackFailed, Scope.Scope> {
  const create: () => string = () => {
    const { encoded } = generateCredentialKeyring();

    return encoded;
  };

  return yield* localSecretFile({
    path,
    schema: CredentialKeyringVariable,
    create,
    invalidReason: 'the credential keyring file is invalid',
  });
});
