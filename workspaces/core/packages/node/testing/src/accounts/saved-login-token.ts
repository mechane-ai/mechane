import { Effect, Schema } from 'effect';
import { join } from 'node:path';
import { FileStep } from '../constants.ts';
import { FileStepFailed } from '../errors.ts';
import { readPrivateFile } from '../sentinels/read-private-file.ts';
import type { Account, PrivateToken } from '../types.ts';

/** Where the CLI's store keeps the saved login, below a configuration root. */
const SAVED_LOGIN_PATH = ['mechane', 'credentials.json'] as const;

/** The saved login as the CLI's store writes it, read only for its token, which the scenario looks for elsewhere. */
const SavedLoginToken = Schema.fromJsonString(Schema.Struct({ token: Schema.String }));

type SavedLoginToken = typeof SavedLoginToken.Type;

type AccountInput = { readonly account: Account };

/** The token of the account's saved login, read from the file the CLI saved it in. */
export const savedLoginToken = Effect.fn('savedLoginToken')(function* ({
  account,
}: AccountInput): Effect.fn.Return<PrivateToken, FileStepFailed> {
  const path = join(account.configurationRoot, ...SAVED_LOGIN_PATH);
  const { text, isPrivate } = yield* readPrivateFile({ path });

  const { token } = yield* Schema.decodeUnknownEffect(SavedLoginToken)(text).pipe(
    Effect.mapError(() => new FileStepFailed({ step: FileStep.Decode, path, reason: 'it holds no saved login' })),
  );

  return { token, isPrivate };
});
