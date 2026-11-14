import { DateTime, Effect } from 'effect';
import type { EvidenceRecord } from './application-schemas.ts';
import type { CollectedEvidence } from './application-types.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from './errors.ts';
import { jsonDigest } from './json-digest.ts';

type CreateEvidenceRecordInput = { readonly evidence: CollectedEvidence };
type ValidateEvidenceRecordInput = { readonly evidence: EvidenceRecord };

/** Evidence is content-addressed before a judge can consume it. */
export function createEvidenceRecord({ evidence }: CreateEvidenceRecordInput): EvidenceRecord {
  const digest = jsonDigest({ value: evidence });
  const createdAt = DateTime.nowUnsafe();

  return { ...evidence, digest, createdAt };
}

/** Editing a saved bundle cannot retain the original evidence identity. */
export const validateEvidenceRecord = Effect.fn('validateEvidenceRecord')(function* ({
  evidence,
}: ValidateEvidenceRecordInput): Effect.fn.Return<void, EvalAdapterFailed> {
  const { digest, createdAt: _createdAt, ...contents } = evidence;
  const actual = jsonDigest({ value: contents });

  if (digest !== actual) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ReadEvidence,
      reason: 'The evidence contents do not match their recorded digest',
    });
  }
});
