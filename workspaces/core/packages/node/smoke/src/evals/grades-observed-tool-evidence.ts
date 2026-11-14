import { createEvalTarget, defineGradeSchema, localTransport, readEval, runEval } from '@mechane/eval';
import type { EvalEnvironment, EvalGradeSchema, EvalSuite } from '@mechane/eval';
import { TurnToolCall } from '@mechane/protocol';
import { BYTES_PER_KIBIBYTE } from '@mechane/records';
import type { LocalStack } from '@mechane/stack';
import { requireFixtures } from '@mechane/testing';
import type { Account } from '@mechane/testing';
import { Duration, Effect, Option, Redacted, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

type ObservedToolEvidenceInput = { readonly stack: LocalStack; readonly account: Account; readonly outFolder: string };

type ObservedSuiteInput = { readonly gradeSchema: EvalGradeSchema; readonly marker: string };
type TrialFailure = Effect.Error<ReturnType<typeof runEval>>;

const ROLE_CAP_MICROS = 1_000_000;
const ROLE_TIMEOUT = Duration.minutes(1);
const CLEANUP_TIMEOUT = Duration.seconds(30);
const EVIDENCE_MAX_BYTES = 64 * BYTES_PER_KIBIBYTE;
const TOOL_MAX_CALLS = 4;
const CONNECTION_NAME = 'Observed application';
const LOOKUP_DESCRIPTION = 'Read the fixture value.';
const Grade = Schema.Struct({ isAccepted: Schema.Boolean });
const ToolCalls = Schema.Array(TurnToolCall);

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
  const modelToolCallId = `toolu_${randomUUID()}`;

  fixtures.model.configure({
    marker,
    replies: [
      { tools: [{ id: modelToolCallId, name: 'lookup', namePrefix: 'mcp_lookup_', input: {} }] },
      { text: 'The application tool completed' },
      {
        tools: [
          { id: randomUUID(), name: 'submit_grade', namePrefix: 'mcp_submit_grade_', input: { isAccepted: true } },
        ],
      },
      { text: 'The judgment was submitted' },
    ],
  });

  const status = await stack.inspect();
  const artifactIdentity = status.application?.appliedSha256;

  assert.ok(artifactIdentity !== undefined);

  const progress: Array<string> = [];

  const executeTrial = Effect.fn('executeTrial')(function* (): Effect.fn.Return<void, TrialFailure> {
    const gradeSchema = yield* defineGradeSchema({ id: 'mechane.smoke-grade', version: '1', schema: Grade });

    const target = yield* createEvalTarget({
      kind: 'local',
      origin: stack.origin,
      artifactIdentity,
      token: Redacted.make(account.token),
      workspaceId: account.workspaceId,
      openTransport: localTransport,
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

    const connections = yield* target.call({
      name: 'listConnections',
      input: { workspaceId: target.access.workspaceId },
      credential: target.access.token,
    });

    assert.equal(
      connections.connections.some((connection) => connection.name === CONNECTION_NAME),
      false,
    );
  });

  await Effect.runPromise(executeTrial());

  const saved = await Effect.runPromise(readEval({ outFolder }));
  const trial = saved.trials.at(0);

  assert.ok(trial !== undefined);
  assert.ok(Option.isSome(trial.subject));
  assert.equal(
    trial.subject.value.isEvidenceComplete,
    true,
    `An observed native invocation was treated as missing: ${JSON.stringify({ unknowns: trial.subject.value.unknowns, progress })}`,
  );
  assert.ok(Option.isSome(trial.evidence) && trial.evidence.value.isComplete);
  assert.ok(Option.isSome(trial.grade) && trial.grade.value.status === 'graded');

  const calls = Schema.decodeUnknownSync(ToolCalls)(trial.subject.value.toolCalls);
  const invocation = calls.find((call) => call.id === modelToolCallId);
  const observation = trial.observations.at(0);

  assert.ok(invocation !== undefined && observation !== undefined);
  assert.notEqual(
    invocation.id,
    invocation.invocationId,
    'The native invocation lost its separate model-call diagnostic',
  );
  assert.equal(invocation.invocationId, observation.callId, 'The trace and durable receipt name different invocations');

  const firstRequest = fixtures.model.readCalls({ marker }).at(0);

  assert.ok(firstRequest !== undefined);

  const tools = Schema.decodeUnknownSync(OfferedTools)(firstRequest.body['tools']);
  const lookup = tools.find((tool) => tool.function.name.startsWith('mcp_lookup_'));

  assert.ok(lookup !== undefined);
  assert.ok(
    lookup.function.description.includes(JSON.stringify(CONNECTION_NAME)),
    'Offered tools lost their connection authority',
  );
  assert.ok(lookup.function.description.endsWith(LOOKUP_DESCRIPTION));
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
      connectionName: CONNECTION_NAME,
      subject: { instructions: 'Use lookup once, then stop.', nativeTools: [] },
      judge: {
        instructions: 'Accept the completed application tool result.',
        nativeTools: [],
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
