import { NotificationText } from '@mechane/protocol';
import { ToolSchema } from '@modelcontextprotocol/sdk/types.js';
import { DateTime, Effect, Option, Schema } from 'effect';
import { gte } from 'semver';
import { EVAL_FORMAT_VERSION, EvalSuiteDefinition } from './application-schemas.ts';
import type { EvalManifest, EvalTargetIdentity } from './application-schemas.ts';
import type { EvalSuite, EvalTarget, ResolvedEvalSuite } from './application-types.ts';
import { EvalAdapterFailed, EvalAdapterOperation, PlanChanged } from './errors.ts';
import { jsonDigest } from './json-digest.ts';
import type { ApplicationStore } from './store/application-store.ts';
import { digestManifest } from './store/encode-eval-records.ts';
import { trialId } from './trial-id.ts';
import type { EvalRunFailure } from './types.ts';
import { validateTargetOrigin } from './validate-target-origin.ts';

type ValidateEvalSuiteInput = { readonly suite: EvalSuite };
type ResolveEvalTargetInput = { readonly target: EvalTarget };

type BuildApplicationManifestInput = { readonly definition: EvalSuiteDefinition; readonly target: EvalTargetIdentity };

type ResolvedSuiteInput = { readonly suite: ResolvedEvalSuite };

type FreezeApplicationManifestInput = ResolvedSuiteInput &
  ResolveEvalTargetInput & { readonly store: ApplicationStore };

/** Resolve and validate every static input before any role can incur work. */
export const resolveEvalSuite = Effect.fn('resolveEvalSuite')(function* ({
  suite,
}: ValidateEvalSuiteInput): Effect.fn.Return<ResolvedEvalSuite, EvalRunFailure> {
  const definition = yield* Schema.decodeUnknownEffect(EvalSuiteDefinition)(suite.definition).pipe(
    Effect.mapError(
      (failure) => new EvalAdapterFailed({ operation: EvalAdapterOperation.ValidateSuite, reason: failure.message }),
    ),
  );

  const caseIds = definition.cases.map((evalCase) => evalCase.id);
  const toolNames = definition.tools.map((tool) => tool.name);

  if (new Set(caseIds).size !== caseIds.length || new Set(toolNames).size !== toolNames.length) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ValidateSuite,
      reason: 'Case IDs and tool names must be distinct',
    });
  }

  if (!definition.judge.isSelfGrading) {
    const subjectModel = Option.fromUndefinedOr(definition.subject.model);
    const judgeModel = Option.fromUndefinedOr(definition.judge.model);

    if (Option.isNone(subjectModel) || Option.isNone(judgeModel) || subjectModel.value === judgeModel.value) {
      return yield* new EvalAdapterFailed({
        operation: EvalAdapterOperation.ValidateJudge,
        reason: 'Independent judging requires two explicitly different model IDs',
      });
    }
  }

  const declaredSchema = jsonDigest({ value: definition.judge.gradeSchema });
  const decodedSchema = jsonDigest({ value: suite.gradeSchema.definition });

  if (declaredSchema !== decodedSchema) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ValidateGradeSchema,
      reason: 'The frozen grade schema differs from its decoder',
    });
  }

  if (definition.judge.nativeTools.length > 0) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ValidateJudgeCapabilities,
      reason: 'Judges must have an empty native tool selection',
    });
  }

  for (const evalCase of definition.cases) {
    const knownJudgeInput = JSON.stringify({ evidence: null, rubric: evalCase.rubric });

    yield* Schema.decodeUnknownEffect(NotificationText)(knownJudgeInput).pipe(
      Effect.mapError(
        (failure) =>
          new EvalAdapterFailed({ operation: EvalAdapterOperation.ValidateJudgeRubric, reason: failure.message }),
      ),
    );
  }

  for (const tool of definition.tools) {
    yield* Effect.try({
      try: () => ToolSchema.parse(tool),
      catch: (cause) =>
        new EvalAdapterFailed({ operation: EvalAdapterOperation.ValidateToolDefinition, reason: String(cause) }),
    });
  }

  return { ...suite, definition };
});

/** Validate public suite configuration without contacting its runtime. */
export const validateEvalSuite = Effect.fn('validateEvalSuite')(function* (
  input: ValidateEvalSuiteInput,
): Effect.fn.Return<void, EvalRunFailure> {
  yield* resolveEvalSuite(input);
});

/** Readiness freezes the selected native runtime and rejects incompatible deployments before creation. */
export const resolveEvalTarget = Effect.fn('resolveEvalTarget')(function* ({
  target,
}: ResolveEvalTargetInput): Effect.fn.Return<EvalTargetIdentity, EvalRunFailure> {
  yield* validateTargetOrigin(target);

  const credential = Option.none();

  const readiness = yield* target.call({ name: 'readiness', input: {}, credential }).pipe(
    Effect.catchTags({
      ResponseUnreadable: () => {
        const failure = new EvalAdapterFailed({
          operation: EvalAdapterOperation.CheckRuntime,
          reason:
            'The selected deployment does not provide the native notification runtime required by this eval release',
        });

        return Effect.fail(failure);
      },
    }),
  );

  if (!gte(readiness.release, '0.33.0')) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.CheckRuntime,
      reason: `Mechane ${readiness.release} predates the required native tool allowlist support in 0.33.0`,
    });
  }

  return {
    kind: target.kind,
    origin: target.origin.origin,
    workspaceId: target.access.workspaceId,
    release: readiness.release,
    runtimeRevision: readiness.runtimeRevision,
    artifactIdentity: target.artifactIdentity,
  };
});

/** Trial identities depend on encoded experiment inputs, independently of the start time. */
export function buildApplicationManifest({ definition, target }: BuildApplicationManifestInput): EvalManifest {
  const version = EVAL_FORMAT_VERSION;
  const digest = digestManifest({ manifest: { version, definition, target } });

  const trials = definition.cases.flatMap(({ id: caseId }) => {
    const repeats = Array.from({ length: definition.repeats }, (_, index) => index + 1);

    return repeats.map((repeat) => ({ id: trialId({ digest, caseId, repeat }), caseId, repeat }));
  });

  return { version, digest, startedAt: DateTime.nowUnsafe(), definition, target, trials };
}

/** Freeze the validated definition before role identities or requests can be created. */
export const freezeApplicationManifest = Effect.fn('freezeApplicationManifest')(function* ({
  store,
  suite,
  target,
}: FreezeApplicationManifestInput): Effect.fn.Return<EvalManifest, EvalRunFailure> {
  const identity = yield* resolveEvalTarget({ target });
  const planned = buildApplicationManifest({ definition: suite.definition, target: identity });
  const saved = yield* store.manifest.read();

  if (Option.isSome(saved)) {
    if (saved.value.digest !== planned.digest) {
      return yield* new PlanChanged({
        path: store.manifest.path,
        savedDigest: saved.value.digest,
        plannedDigest: planned.digest,
      });
    }

    return saved.value;
  }

  yield* store.manifest.create({ record: planned });

  return planned;
});
