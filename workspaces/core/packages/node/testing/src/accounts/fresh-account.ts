import { CliVariable } from '@mechane/program';
import { Effect } from 'effect';
import { randomBytes } from 'node:crypto';
import type { FileStepFailed } from '../errors.ts';
import { freshFolder } from '../fresh-folder.ts';
import type { Account, StackInput } from '../types.ts';

/** The prefixes of an account's folder in the stack's state folder and of its GitHub login. */
const AccountPrefix = { Folder: 'account-', Login: 'smoke-' } as const;

/** How many random bytes tell one account's GitHub login from another's. */
const LOGIN_SUFFIX_BYTES = 4;

/**
 * A fresh account: a configuration folder in the stack's state folder, which a failed run keeps. Its GitHub login is
 * one no other account signs in as, so its first login signs a new identity up.
 */
export const freshAccount = Effect.fn('freshAccount')(function* ({
  stack,
}: StackInput): Effect.fn.Return<Account, FileStepFailed> {
  const login = `${AccountPrefix.Login}${randomBytes(LOGIN_SUFFIX_BYTES).toString('hex')}`;
  const configurationRoot = yield* freshFolder({ stack, prefix: AccountPrefix.Folder });

  return { login, configurationRoot, environment: { [CliVariable.ConfigHome]: configurationRoot } };
});
