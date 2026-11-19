import {
  calibrateEval,
  createEvalTarget,
  DEFAULT_INSPECTION_OPTIONS,
  defineGradeSchema,
  evalInspection,
  inspectCalibration,
  readEval,
  runEval,
} from '@mechane/eval';
import type { CompareCalibration, EvalEnvironment, EvalGradeSchema, EvalSuite } from '@mechane/eval';
import { BYTES_PER_KIBIBYTE } from '@mechane/records';
import type { LocalStack } from '@mechane/stack';
import { requireFixtures } from '@mechane/testing';
import type { Account } from '@mechane/testing';
import { Duration, Effect, Option, Redacted, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

type ObservedToolEvidenceInput = { readonly stack: LocalStack; readonly account: Account; readonly outFolder: string };

type ObservedSuiteInput = { readonly gradeSchema: EvalGradeSchema; readonly marker: string };
type TrialFailure = Effect.Error<ReturnType<typeof runEval>>;

const ROLE_CAP_MICROS = 1_000_000;
const ROLE_TIMEOUT = Duration.minutes(1);
const CLEANUP_TIMEOUT = Duration.seconds(30);
const EVIDENCE_MAX_BYTES = 64 * BYTES_PER_KIBIBYTE;
const TOOL_MAX_CALLS = 4;
const LOOKUP_DESCRIPTION = 'Read the fixture value.';
const Grade = Schema.Struct({ isAccepted: Schema.Boolean });

const CustomToolUse = Schema.Struct({
  type: Schema.Literal('agent.custom_tool_use'),
  id: Schema.String,
  name: Schema.String,
});

const OfferedTools = Schema.Array(
  Schema.Struct({ function: Schema.Struct({ name: Schema.String, description: Schema.String }) }),
);

export async function gradesObservedToolEvidence({
  stack,
  account,
  outFolder,
}: ObservedToolEvidenceInput): Promise<void> {
  const fixtures = requireFixtures(stack);
  const marker = `observed-tool-${randomUUID()}`;

  fixtures.model.configure({
    marker,
    replies: [
      { tools: [{ id: randomUUID(), name: 'lookup', input: {} }] },
      { text: 'The application tool completed' },
      { tools: [{ id: randomUUID(), name: 'submit_grade', input: { isAccepted: true } }] },
      { text: 'The judgment was submitted' },
      { tools: [{ id: randomUUID(), name: 'submit_grade', input: { isAccepted: true } }] },
      { text: 'The calibration judgment was submitted' },
    ],
  });

  const status = await stack.inspect();
  const artifactIdentity = status.application?.appliedSha256;

  assert.ok(artifactIdentity !== undefined);

  const progress: Array<string> = [];

  await refusesRemoteLocalTarget({ token: account.token, workspaceId: account.workspaceId });

  const executeTrial = Effect.fn('executeTrial')(function* (): Effect.fn.Return<void, TrialFailure> {
    const gradeSchema = yield* defineGradeSchema({ id: 'mechane.smoke-grade', version: '1', schema: Grade });

    const target = yield* createEvalTarget({
      kind: 'local',
      origin: stack.origin,
      artifactIdentity,
      token: Redacted.make(account.token),
      workspaceId: account.workspaceId,
    });

    const suite = createObservedSuite({ gradeSchema, marker });

    yield* runEval({
      suite,
      target,
      outFolder,
      writeProgress: ({ line }) => {
        progress.push(line);
      },
    });

    const source = yield* readEval({ outFolder });
    const evidence = source.trials.at(0)?.evidence;

    assert.ok(evidence !== undefined && Option.isSome(evidence));

    const auditId = 'frozen-calibration';

    yield* calibrateEval({
      suite,
      target,
      outFolder,
      auditId,
      writeProgress: () => undefined,
      examples: [
        {
          id: 'observed-tool',
          rubric: 'Accept the recorded fixture value.',
          evidence: evidence.value,
          expected: { isAccepted: false },
        },
      ],
    });

    const audit = yield* readEval({ outFolder: join(outFolder, 'audits', auditId) });
    const inspection = evalInspection({ ...DEFAULT_INSPECTION_OPTIONS, saved: audit });

    const compareExpected: CompareCalibration = ({ expected, observed }) =>
      Option.some(
        Schema.decodeUnknownSync(Grade)(expected).isAccepted === Schema.decodeUnknownSync(Grade)(observed).isAccepted,
      );

    const calibration = yield* inspectCalibration({ inspection, compareExpected });

    assert.ok(Option.isSome(calibration));
    assert.deepEqual(
      [calibration.value.comparedTrials, calibration.value.agreedTrials],
      [1, 0],
      'A disagreement with the saved label was lost',
    );

    const incomplete = evalInspection({
      ...DEFAULT_INSPECTION_OPTIONS,
      saved: { ...audit, trials: audit.trials.map((trial) => ({ ...trial, grade: Option.none() })) },
    });

    const missingGrade = yield* inspectCalibration({ inspection: incomplete, compareExpected });

    assert.ok(Option.isSome(missingGrade));
    assert.equal(missingGrade.value.comparedTrials, 0, 'An absent grade entered calibration agreement');
  });

  await Effect.runPromise(executeTrial());

  const saved = await Effect.runPromise(readEval({ outFolder }));
  const trial = saved.trials.at(0);

  assert.ok(trial !== undefined);
  assert.ok(Option.isSome(trial.subject));
  assert.equal(
    trial.subject.value.isEvidenceComplete,
    true,
    `The completed custom tool call has incomplete evidence: ${JSON.stringify({ unknowns: trial.subject.value.unknowns, progress })}`,
  );
  assert.ok(Option.isSome(trial.evidence) && trial.evidence.value.isComplete);
  assert.ok(Option.isSome(trial.grade) && trial.grade.value.status === 'graded');

  const calls = trial.subject.value.toolCalls.filter(Schema.is(CustomToolUse));
  const invocation = calls.find((call) => call.name === 'lookup');
  const observation = trial.observations.at(0);

  assert.ok(invocation !== undefined && observation !== undefined);
  assert.equal(invocation.id, observation.callId, 'The session event and durable observation name different calls');
  assert.deepEqual(observation.result.output, { marker });

  const firstRequest = fixtures.model.readCalls({ marker }).at(0);

  assert.ok(firstRequest !== undefined);

  const tools = Schema.decodeUnknownSync(OfferedTools)(firstRequest.body['tools']);
  const lookup = tools.find((tool) => tool.function.name === 'lookup');

  assert.ok(lookup !== undefined);
  assert.equal(lookup.function.description, LOOKUP_DESCRIPTION);
}

function createObservedSuite({ gradeSchema, marker }: ObservedSuiteInput): EvalSuite {
  const execute: EvalEnvironment['execute'] = () => Effect.succeed({ output: { marker }, isError: false });
  const environment: EvalEnvironment = { execute, release: Effect.void };
  const openEnvironment: EvalSuite['openEnvironment'] = () => Effect.succeed(environment);

  const collectEvidence: EvalSuite['collectEvidence'] = ({ observations }) =>
    Effect.succeed({
      schema: { id: 'mechane.smoke-evidence', version: '1' },
      value: { marker, outputs: observations.map((observation) => observation.result.output) },
      scope: ['The recorded application tool result.'],
      isComplete: true,
    });

  const suite: EvalSuite = {
    definition: {
      id: 'observed-tool-evidence',
      version: '1',
      adapter: { id: 'observed-tool-evidence', version: '1', fingerprint: 'observed-tool-evidence-v1' },
      subject: { model: 'claude-haiku-5-5', instructions: 'Use lookup once, then stop.' },
      judge: {
        instructions: 'Accept the completed application tool result.',
        model: 'claude-haiku-5-5',
        isSelfGrading: true,
        gradeSchema: gradeSchema.definition,
      },
      bounds: {
        roleCapMicros: ROLE_CAP_MICROS,
        roleTimeoutMs: Duration.toMillis(ROLE_TIMEOUT),
        cleanupTimeoutMs: Duration.toMillis(CLEANUP_TIMEOUT),
        maxObservationBytes: EVIDENCE_MAX_BYTES,
        maxEvidenceBytes: EVIDENCE_MAX_BYTES,
        maxToolCalls: TOOL_MAX_CALLS,
      },
      repeats: 1,
      tools: [
        {
          name: 'lookup',
          description: LOOKUP_DESCRIPTION,
          inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        },
      ],
      cases: [{ id: 'observed-tool', input: marker, visible: null, rubric: 'Accept the recorded fixture value.' }],
      components: {},
    },
    gradeSchema,
    openEnvironment,
    collectEvidence,
    validateGrade: Option.none(),
  };

  return suite;
}

type RefusedTargetInput = { readonly token: string; readonly workspaceId: string };

async function refusesRemoteLocalTarget({ token, workspaceId }: RefusedTargetInput): Promise<void> {
  await assert.rejects(
    Effect.runPromise(
      createEvalTarget({
        origin: new URL('https://example.invalid'),
        kind: 'local',
        token: Redacted.make(token),
        workspaceId,
        artifactIdentity: 'rejected-local-target',
      }),
    ),
    /loopback origin/u,
  );
}
