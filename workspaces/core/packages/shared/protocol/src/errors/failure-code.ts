import { Schema } from 'effect';
import { UnknownFailure } from './errors.ts';
import type { ServerFailure } from './errors.ts';

type FailureCodeInput = { readonly failure: ServerFailure | UnknownFailure };

/** The code an error body gave a failure: a known failure's tag, or the code this release does not know. */
export function failureCode({ failure }: FailureCodeInput): string {
  if (Schema.is(UnknownFailure)(failure)) {
    return failure.code;
  }

  return failure._tag;
}
