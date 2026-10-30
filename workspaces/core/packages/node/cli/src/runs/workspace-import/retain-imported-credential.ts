import type { OperationFailed } from '@mechane/client';
import { CredentialAlreadyExists } from '@mechane/protocol';
import { Effect, Result, Schema } from 'effect';
import type { CredentialImportResult } from './types.ts';

type RetainImportedCredentialInput = { readonly secretReference: string; readonly failure: OperationFailed };

/** An existing value is retained without comparing or reading it. */
export const retainImportedCredential = Effect.fn('retainImportedCredential')(function* ({
  secretReference,
  failure,
}: RetainImportedCredentialInput): Effect.fn.Return<CredentialImportResult, OperationFailed> {
  const existing = Schema.decodeUnknownResult(CredentialAlreadyExists)(failure.failure);

  if (Result.isFailure(existing)) {
    return yield* failure;
  }

  return { secretReference, isCreated: false };
});
