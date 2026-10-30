import type { ClientFailure, OperationFailed } from '@mechane/client';
import { Effect, Record } from 'effect';
import type { Redacted } from 'effect';
import { retainImportedCredential } from './retain-imported-credential.ts';
import type { CredentialImportResult, ImportWorkspaceInput } from './types.ts';

type ImportWorkspaceCredentialsInput = Pick<ImportWorkspaceInput, 'call' | 'token' | 'workspaceId' | 'document'>;

type ImportWorkspaceCredentialInput = Pick<ImportWorkspaceInput, 'call' | 'token' | 'workspaceId'> & {
  readonly secretReference: string;
  readonly value: Redacted.Redacted;
};

/** Retains existing references without reading their values, so repeated imports cannot overwrite runtime rotations. */
export const importWorkspaceCredentials = Effect.fn('importWorkspaceCredentials')(function* ({
  call,
  token,
  workspaceId,
  document,
}: ImportWorkspaceCredentialsInput): Effect.fn.Return<ReadonlyArray<CredentialImportResult>, ClientFailure> {
  const entries = Record.toEntries(document.credentials);

  const importCredential: (
    entry: readonly [string, Redacted.Redacted],
  ) => Effect.Effect<CredentialImportResult, ClientFailure> = ([secretReference, value]) => {
    const retain: (failure: OperationFailed) => Effect.Effect<CredentialImportResult, OperationFailed> = (failure) =>
      retainImportedCredential({ secretReference, failure });

    const imported = importWorkspaceCredential({ call, token, workspaceId, secretReference, value });

    return imported.pipe(Effect.catchTags({ OperationFailed: retain }));
  };

  return yield* Effect.forEach(entries, importCredential, { concurrency: 1 });
});

const importWorkspaceCredential = Effect.fn('importWorkspaceCredential')(function* ({
  call,
  token,
  workspaceId,
  secretReference,
  value,
}: ImportWorkspaceCredentialInput): Effect.fn.Return<CredentialImportResult, ClientFailure> {
  const input = { workspaceId, secretReference, value, isCreateOnly: true };

  yield* call({ name: 'putCredential', input, credential: token });

  return { secretReference, isCreated: true };
});
