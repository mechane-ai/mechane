import { PrincipalId } from '@mechane/records';
import type { SqlCall } from '@mechane/store';
import { Option, Result, Schema } from 'effect';
import type { PrincipalInput } from '../inputs.types.ts';
import type { PrincipalRow } from '../schemas.ts';
import { findPrincipal } from './find-principal.ts';

/** Existing keys and identities must never reference a principal absent from the directory. */
class PrincipalRecordMissing extends Schema.TaggedError<PrincipalRecordMissing>()('PrincipalRecordMissing', {
  principalId: PrincipalId,
}) {}

/** Missing rows behind an owned key or identity are storage defects, not unknown-user refusals. */
export function requiredPrincipal({ sql, principalId }: SqlCall<PrincipalInput>): PrincipalRow {
  const found = findPrincipal({ sql, principalId });

  if (Option.isSome(found)) {
    return found.value;
  }

  const id = PrincipalId.make(principalId);
  const error = new PrincipalRecordMissing({ principalId: id });
  const failure = Result.fail(error);

  return Result.getOrThrow(failure);
}
