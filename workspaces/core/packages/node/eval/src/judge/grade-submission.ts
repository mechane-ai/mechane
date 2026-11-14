import { DateTime, Effect, Option, Result, Semaphore } from 'effect';
import type { EvalToolResult, GradeSubmission } from '../application-schemas.ts';
import type { EvalEnvironment, GradeEvidenceInput, Json } from '../application-types.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from '../errors.ts';
import { jsonDigest } from '../json-digest.ts';

export const SUBMIT_GRADE_TOOL = 'submit_grade';

const SubmissionStatus = { Accepted: 'accepted', Conflict: 'conflict', Invalid: 'invalid' } as const;

type SubmissionReceiptInput = { readonly submission: GradeSubmission };

/** The receipt names the durable submission, so an exact retry receives the original acknowledgment. */
function createSubmissionReceipt({ submission }: SubmissionReceiptInput): Json {
  const submittedAt = DateTime.formatIso(submission.submittedAt);

  return { status: SubmissionStatus.Accepted, digest: submission.digest, submittedAt };
}

export const openGradeEnvironment = Effect.fn('openGradeEnvironment')(function* ({
  suite,
  evidence,
  rubric,
  context,
}: GradeEvidenceInput): Effect.fn.Return<EvalEnvironment> {
  const semaphore = yield* Semaphore.make(1);
  const { submission } = context.files;

  const submit = Effect.fn('submit')(function* ({
    arguments: proposed,
  }: Parameters<EvalEnvironment['execute']>[0]): Effect.fn.Return<EvalToolResult, EvalAdapterFailed> {
    const decoding = decodeSubmission({ suite, evidence, rubric, proposed });

    const decoded = yield* decoding.pipe(
      Effect.catchTags({
        EvalAdapterFailed: (failure) => {
          const invalid = Result.fail(failure);

          return Effect.succeed(invalid);
        },
      }),
    );

    if (Result.isFailure(decoded)) {
      return { output: { status: SubmissionStatus.Invalid, issue: decoded.failure.reason }, isError: true };
    }

    const value = decoded.success;
    const digest = jsonDigest({ value });

    const previous = yield* submission
      .read()
      .pipe(
        Effect.mapError(
          (error) =>
            new EvalAdapterFailed({ operation: EvalAdapterOperation.SaveGradeSubmission, reason: error.reason }),
        ),
      );

    if (Option.isSome(previous)) {
      const previousSchemaDigest = jsonDigest({ value: previous.value.schema });
      const schemaDigest = jsonDigest({ value: suite.gradeSchema.definition });

      if (
        previous.value.digest !== digest ||
        previous.value.evidenceDigest !== evidence.digest ||
        previousSchemaDigest !== schemaDigest
      ) {
        return { output: { status: SubmissionStatus.Conflict }, isError: true };
      }

      return { output: createSubmissionReceipt({ submission: previous.value }), isError: false };
    }

    const submitted = DateTime.nowUnsafe();

    const accepted: GradeSubmission = {
      value,
      digest,
      schema: suite.gradeSchema.definition,
      evidenceDigest: evidence.digest,
      submittedAt: submitted,
    };

    yield* submission
      .create({ record: accepted })
      .pipe(
        Effect.mapError(
          (error) =>
            new EvalAdapterFailed({ operation: EvalAdapterOperation.SaveGradeSubmission, reason: error.reason }),
        ),
      );

    return { output: createSubmissionReceipt({ submission: accepted }), isError: false };
  });

  const execute: EvalEnvironment['execute'] = (input) => submit(input).pipe(Semaphore.withPermits(semaphore, 1));

  return { execute, release: Effect.void };
});

type DecodeSubmissionInput = Pick<GradeEvidenceInput, 'suite' | 'evidence' | 'rubric'> & { readonly proposed: Json };

const decodeSubmission = Effect.fn('decodeSubmission')(function* ({
  suite,
  evidence,
  rubric,
  proposed,
}: DecodeSubmissionInput): Effect.fn.Return<Result.Result<Json, EvalAdapterFailed>, EvalAdapterFailed> {
  const value = yield* suite.gradeSchema.decode({ value: proposed });
  const validate = suite.validateGrade;

  if (Option.isSome(validate)) {
    yield* validate.value({ value, evidence, rubric });
  }

  return Result.succeed(value);
});
