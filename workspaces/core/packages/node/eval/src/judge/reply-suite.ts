import { NotificationText } from '@mechane/protocol';
import { BYTES_PER_KIBIBYTE } from '@mechane/records';
import { Duration, Effect, Option, Schema } from 'effect';
import { EvalRoleStatus } from '../application-schemas.ts';
import type { EvalToolResult } from '../application-schemas.ts';
import type { CollectedEvidence, EvalSuite, ExecuteToolInput, ValidateGradeInput } from '../application-types.ts';
import { PUBLICATION_INSTRUCTIONS } from '../constants.ts';
import { defineGradeSchema } from '../define-grade-schema.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from '../errors.ts';
import { jsonDigest } from '../json-digest.ts';
import { Expectation, Grade } from '../schemas.ts';
import type { Suite } from '../schemas.ts';

const REPLY_ADAPTER_VERSION = '1';
const ROLE_TIMEOUT = Duration.minutes(5);
const CLEANUP_TIMEOUT = Duration.seconds(30);
const OBSERVATION_MAX_BYTES = 64 * BYTES_PER_KIBIBYTE;
const EVIDENCE_MAX_BYTES = 24 * BYTES_PER_KIBIBYTE;
const TOOL_MAX_CALLS = 12;

const REPLY_JUDGE_INSTRUCTIONS = [
  'Grade one reply against each expectation of the input it answered, judging only what the reply says.',
  'Use one criterion for every expectation, under its id, exactly once.',
  'A criterion verdict is pass, fail or uncertain; uncertain remains an unknown judgment.',
  "Include a short quote or reason as each criterion's evidence and a one-sentence summary.",
].join(' ');

const ReplyRubric = Schema.Array(Expectation);

type ReplyRubric = typeof ReplyRubric.Type;

type ReplySuiteInput = { readonly suite: Suite };

/** The existing reply evaluation uses the shared runner without changing its criterion verdicts. */
export const replySuite = Effect.fn('replySuite')(function* ({
  suite,
}: ReplySuiteInput): Effect.fn.Return<EvalSuite, EvalAdapterFailed> {
  const gradeSchema = yield* defineGradeSchema({
    id: 'mechane.reply-grade',
    version: REPLY_ADAPTER_VERSION,
    schema: Grade,
  });

  const bounds: EvalSuite['definition']['bounds'] = {
    roleCapMicros: suite.trialCapMicros,
    roleTimeoutMs: Duration.toMillis(ROLE_TIMEOUT),
    cleanupTimeoutMs: Duration.toMillis(CLEANUP_TIMEOUT),
    maxObservationBytes: OBSERVATION_MAX_BYTES,
    maxEvidenceBytes: EVIDENCE_MAX_BYTES,
    maxToolCalls: TOOL_MAX_CALLS,
  };

  const configuredInstructions = Option.fromUndefinedOr(suite.subject.instructions);

  const subjectInstructions = Option.match(configuredInstructions, {
    onNone: () => PUBLICATION_INSTRUCTIONS,
    onSome: (instructions) => `${instructions}\n\n${PUBLICATION_INSTRUCTIONS}`,
  });

  const definition: EvalSuite['definition'] = {
    id: suite.id,
    version: REPLY_ADAPTER_VERSION,
    connectionName: 'Eval tools',
    adapter: {
      id: 'mechane.reply-suite',
      version: REPLY_ADAPTER_VERSION,
      fingerprint: jsonDigest({ value: { version: REPLY_ADAPTER_VERSION, gradeSchema: gradeSchema.definition } }),
    },
    subject: { ...suite.subject, instructions: subjectInstructions, nativeTools: ['console_message'] },
    judge: {
      ...suite.grader,
      instructions: REPLY_JUDGE_INSTRUCTIONS,
      isSelfGrading: suite.isSelfGrading,
      gradeSchema: gradeSchema.definition,
      nativeTools: [],
    },
    repeats: suite.repeats,
    bounds,
    tools: [],
    cases: suite.cases.map((evalCase) => ({
      id: evalCase.id,
      input: evalCase.input,
      visible: evalCase.input,
      rubric: evalCase.expectations,
    })),
    components: { replyAdapterVersion: REPLY_ADAPTER_VERSION },
  };

  const selectedValidation = Option.some(validateGrade);

  const adapter: EvalSuite = {
    definition,
    gradeSchema,
    openEnvironment,
    collectEvidence,
    validateGrade: selectedValidation,
  };

  return adapter;
});

const openEnvironment: EvalSuite['openEnvironment'] = () => {
  const execute = Effect.fn('execute')(function* ({
    name,
  }: ExecuteToolInput): Effect.fn.Return<EvalToolResult, EvalAdapterFailed> {
    return yield* new EvalAdapterFailed({ operation: EvalAdapterOperation.ExecuteReplyTool, reason: name });
  });

  return Effect.succeed({ execute, release: Effect.void });
};

const collectEvidence: EvalSuite['collectEvidence'] = Effect.fn('collectEvidence')(function* ({
  visible,
  subject,
}): Effect.fn.Return<CollectedEvidence, EvalAdapterFailed> {
  const input = yield* Schema.decodeUnknownEffect(NotificationText, { onExcessProperty: 'error' })(visible).pipe(
    Effect.mapError(
      (error) => new EvalAdapterFailed({ operation: EvalAdapterOperation.DecodeReplyInput, reason: error.message }),
    ),
  );

  const reply = Option.fromUndefinedOr(subject.reply);
  const value = { input, reply: Option.getOrNull(reply) };
  const schema = { id: 'mechane.reply-evidence', version: REPLY_ADAPTER_VERSION };
  const scope = ["The subject's explicit public reply, assessed against its private expectations."];

  if (subject.status !== EvalRoleStatus.Completed || !subject.isEvidenceComplete) {
    return { schema, value, scope, isComplete: false, issue: 'The subject did not complete its reply' };
  }

  if (Option.isNone(reply)) {
    return { schema, value, scope, isComplete: false, issue: 'The subject did not publish a reply' };
  }

  return { schema, value, scope, isComplete: true };
});

const validateGrade = Effect.fn('validateGrade')(function* ({
  value,
  rubric,
}: ValidateGradeInput): Effect.fn.Return<void, EvalAdapterFailed> {
  const grade = yield* Schema.decodeUnknownEffect(Grade, { onExcessProperty: 'error' })(value).pipe(
    Effect.mapError(
      (error) => new EvalAdapterFailed({ operation: EvalAdapterOperation.DecodeReplyGrade, reason: error.message }),
    ),
  );

  const expectations: ReplyRubric = yield* Schema.decodeUnknownEffect(ReplyRubric, { onExcessProperty: 'error' })(
    rubric,
  ).pipe(
    Effect.mapError(
      (error) => new EvalAdapterFailed({ operation: EvalAdapterOperation.DecodeReplyRubric, reason: error.message }),
    ),
  );

  const expectedIds = expectations.map(({ id }) => id).toSorted();
  const gradedIds = grade.criteria.map(({ id }) => id).toSorted();

  if (JSON.stringify(gradedIds) !== JSON.stringify(expectedIds)) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ValidateReplyCriteria,
      reason: 'The grade must assess every expectation exactly once',
    });
  }
});
