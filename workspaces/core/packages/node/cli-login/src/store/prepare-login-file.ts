import { CredentialsFailed, CredentialsStep } from '@mechane/cli-kernel';
import { PrivateMode } from '@mechane/program';
import { Effect, Schema } from 'effect';
import { chmod, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { SAVED_LOGIN_SCHEMA_VERSION } from '../constants.ts';
import type { SavedLogin } from '../schemas.ts';
import { credentialsPath } from './credentials-path.ts';
import { SavedLoginJson } from './schemas.ts';
import type { ConfigurationRootInput, PathInput } from './types.ts';
import { writePrivateFile } from './write-private-file.ts';

/** A login to save, which the CLI built from a claimed device approval. */
type LoginInput = { readonly login: Omit<SavedLogin, 'schemaVersion'> };

/** The saved login's file in its prepared folder: its save answers with the file's path. */
type LoginFile = { readonly save: (input: LoginInput) => Effect.Effect<string, CredentialsFailed> };

type SaveLoginInput = LoginInput & PathInput;

/**
 * Creates the CLI's private folder, which only its owner may enter and write, and answers with the save of a login into
 * it. A login prepares it before its approval starts, so one that could not save fails before a key nobody holds.
 */
export const prepareLoginFile = Effect.fn('prepareLoginFile')(function* ({
  configurationRoot,
}: ConfigurationRootInput): Effect.fn.Return<LoginFile, CredentialsFailed> {
  const path = credentialsPath({ configurationRoot });
  const folder = dirname(path);

  yield* Effect.tryPromise({
    try: () => mkdir(folder, { recursive: true, mode: PrivateMode.Folder }),
    catch: (cause) =>
      new CredentialsFailed({ step: CredentialsStep.CreateFolder, path: folder, reason: String(cause) }),
  });
  // A folder that existed keeps its mode through `mkdir`, so the mode is set again.
  yield* Effect.tryPromise({
    try: () => chmod(folder, PrivateMode.Folder),
    catch: (cause) =>
      new CredentialsFailed({ step: CredentialsStep.CreateFolder, path: folder, reason: String(cause) }),
  });

  const save: LoginFile['save'] = ({ login }) => saveLogin({ path, login });

  return { save };
});

/** Saves a login in place of the one before, and answers with the file's path. */
const saveLogin = Effect.fn('saveLogin')(function* ({
  path,
  login,
}: SaveLoginInput): Effect.fn.Return<string, CredentialsFailed> {
  // The CLI built the login to the schema's type, so encoding it cannot fail.
  const text = Schema.encodeSync(SavedLoginJson)({ schemaVersion: SAVED_LOGIN_SCHEMA_VERSION, ...login });

  yield* writePrivateFile({ path, text: `${text}\n` });

  return path;
});
