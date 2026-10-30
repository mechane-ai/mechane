import { Schema } from 'effect';
import { DIGEST_PATTERN, OCI_SIZE_KEY } from '../constants.ts';

/** Accepts only SHA-256-addressed, nonempty blobs from an OCI layout. */
export const OciDescriptor = Schema.Struct({
  digest: Schema.String.check(Schema.isPattern(DIGEST_PATTERN)),
  [OCI_SIZE_KEY]: Schema.Int.check(Schema.isGreaterThan(0)),
});

export type OciDescriptor = typeof OciDescriptor.Type;
