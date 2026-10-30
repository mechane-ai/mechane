import { CredentialsFailed, CredentialsStep } from '@mechane/cli-kernel';
import { Effect, Schema } from 'effect';
import { readFile } from 'node:fs/promises';
import { WorkspaceImport } from './schemas.ts';

type ReadWorkspaceImportInput = { readonly file: string };

/** Validation failures discard parser diagnostics because the document contains credential values. */
export const readWorkspaceImport = Effect.fn('readWorkspaceImport')(function* ({
  file,
}: ReadWorkspaceImportInput): Effect.fn.Return<WorkspaceImport, CredentialsFailed> {
  const text = yield* Effect.tryPromise({
    try: () => readFile(file, 'utf8'),
    catch: () =>
      new CredentialsFailed({ step: CredentialsStep.Read, path: file, reason: 'could not read import file' }),
  });

  const schema = Schema.fromJsonString(WorkspaceImport);
  const options = { onExcessProperty: 'error' } as const;

  return yield* Schema.decodeUnknownEffect(
    schema,
    options,
  )(text).pipe(
    Effect.mapError(
      () =>
        new CredentialsFailed({ step: CredentialsStep.Decode, path: file, reason: 'runtime import file is invalid' }),
    ),
  );
});
