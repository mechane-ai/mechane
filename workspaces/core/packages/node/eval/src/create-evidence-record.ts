import { DateTime, Effect, Option } from 'effect';
import type { EvidenceRecord } from './application-schemas.ts';
import type { CollectedEvidence } from './application-types.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from './errors.ts';
import { jsonDigest } from './json-digest.ts';

type CreateEvidenceRecordInput = { readonly evidence: CollectedEvidence };
type ValidateEvidenceRecordInput = { readonly evidence: EvidenceRecord };

/** Evidence is content-addressed before a judge can consume it. */
export function createEvidenceRecord({ evidence }: CreateEvidenceRecordInput): EvidenceRecord {
  const contents = evidenceContents({ evidence });
  const digest = jsonDigest({ value: contents });
  const createdAt = DateTime.nowUnsafe();

  return { ...contents, digest, createdAt };
}

function evidenceContents({ evidence }: CreateEvidenceRecordInput): CollectedEvidence {
  const contents = {
    schema: evidence.schema,
    value: evidence.value,
    scope: evidence.scope,
    isComplete: evidence.isComplete,
  };

  const issue = Option.fromUndefinedOr(evidence.issue);

  if (Option.isNone(issue)) {
    return contents;
  }

  return { ...contents, issue: issue.value };
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
