import { wireKey } from '@mechane/records';
import { Record, Schema } from 'effect';
import type { UnknownFields } from '../schemas.ts';
import { FAILURE_FAMILY } from './failure-family.ts';
import type { ErrorDetail } from './schemas.ts';
import { ServerFailure } from './server-failure.errors.ts';

/** A failure the Worker answers with, and the deployment's message for it. */
type ErrorDetailInput = { readonly failure: ServerFailure; readonly message: string };

/**
 * The wire form of a failure: its family, its code and the deployment's message, beside its own encoded fields under
 * snake_case keys. A client decodes a failure it knows from them, with what it carried.
 */
export function errorDetail({ failure, message }: ErrorDetailInput): ErrorDetail {
  // The failure is one of the union's members, so encoding it cannot fail.
  const { _tag: code, ...fields } = Schema.encodeSync(ServerFailure)(failure);
  const encodedFields: UnknownFields = fields;

  return {
    family: FAILURE_FAMILY[code],
    code,
    message,
    ...Record.mapKeys(encodedFields, (field) => wireKey({ field })),
  };
}
