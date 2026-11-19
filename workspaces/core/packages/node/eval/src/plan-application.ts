import { NotificationText } from '@mechane/protocol';
import { DateTime, Effect, Option, Schema } from 'effect';
import { EVAL_FORMAT_VERSION, EvalSuiteDefinition } from './application-schemas.ts';
import type { EvalManifest, EvalTargetIdentity } from './application-schemas.ts';
import type { EvalSuite, EvalTarget, ResolvedEvalSuite } from './application-types.ts';
import { EvalAdapterFailed, EvalAdapterOperation, PlanChanged } from './errors.ts';
import { jsonDigest } from './json-digest.ts';
import { managedRequest } from './managed-request.ts';
import type { ApplicationStore } from './store/application-store.ts';
import { digestManifest } from './store/encode-eval-records.ts';
import { trialId } from './trial-id.ts';
import type { EvalRunFailure } from './types.ts';
import { validateTargetOrigin } from './validate-target-origin.ts';

const OBJECT_INPUT = 'object';
const hasObjectInput = Schema.is(Schema.Struct({ type: Schema.Literal(OBJECT_INPUT) }));

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
  const definition = yield* Schema.decodeUnknownEffect(EvalSuiteDefinition, { onExcessProperty: 'error' })(
    suite.definition,
  ).pipe(
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

  if (!definition.judge.isSelfGrading && definition.subject.model === definition.judge.model) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ValidateJudge,
      reason: 'Independent judging requires two explicitly different model IDs',
    });
  }

  const declaredSchema = jsonDigest({ value: definition.judge.gradeSchema });
  const decodedSchema = jsonDigest({ value: suite.gradeSchema.definition });

  if (declaredSchema !== decodedSchema) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ValidateGradeSchema,
      reason: 'The frozen grade schema differs from its decoder',
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
    const schema = tool.inputSchema;

    if (!hasObjectInput(schema)) {
      return yield* new EvalAdapterFailed({
        operation: EvalAdapterOperation.ValidateToolDefinition,
        reason: `Tool ${tool.name} requires an object input schema`,
      });
    }
  }

  return { ...suite, definition };
});

/** Validate public suite configuration without contacting its runtime. */
export const validateEvalSuite = Effect.fn('validateEvalSuite')(function* (
  input: ValidateEvalSuiteInput,
): Effect.fn.Return<void, EvalRunFailure> {
  yield* resolveEvalSuite(input);
});

/** Check deployment identity and authenticated workspace access before creating any resource. */
export const resolveEvalTarget = Effect.fn('resolveEvalTarget')(function* ({
  target,
}: ResolveEvalTargetInput): Effect.fn.Return<EvalTargetIdentity, EvalRunFailure> {
  yield* validateTargetOrigin(target);

  const credential = Option.none();

  const readiness = yield* target.call({ name: 'readiness', input: {}, credential });

  yield* managedRequest({
    action: 'check Managed Agents workspace access',
    operation: (signal) => target.managed.beta.agents.list({ limit: 1 }, { signal }),
  });

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
