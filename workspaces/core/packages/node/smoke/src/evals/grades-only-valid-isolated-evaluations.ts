import Anthropic from '@anthropic-ai/sdk';
import { WorkspaceList } from '@mechane/protocol';
import type { ModelFixture } from '@mechane/stack';
import { createAccount, requireFixtures, runCli, startCli } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Record, Result, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { creationResponseProxy } from './creation-response-proxy.ts';
import { gradesObservedToolEvidence } from './grades-observed-tool-evidence.ts';

const MODEL = 'claude-haiku-5-5';
const ACCEPTED_SUBMISSIONS = 2;
const CLI_DIAGNOSTIC_MAX_CHARS = 4096;
const SUBMIT_GRADE = 'submit_grade';

const EvalEnvelope = Schema.Struct({
  result: Schema.Struct({
    trials: Schema.Array(
      Schema.Struct({
        caseId: Schema.String,
        stages: Schema.Struct({ grading: Schema.String }),
        quality: Schema.Struct({ kind: Schema.String, verdict: Schema.optionalKey(Schema.String) }),
        failures: Schema.Array(Schema.Struct({ tag: Schema.String, reason: Schema.String })),
      }),
    ),
  }),
});

const EvalOutput = Schema.fromJsonString(EvalEnvelope);

const RefusedEval = Schema.fromJsonString(
  Schema.Struct({ errors: Schema.Array(Schema.Struct({ code: Schema.String })) }),
);

const OfferedTools = Schema.Array(Schema.Struct({ function: Schema.Struct({ name: Schema.String }) }));
const ModelMessages = Schema.Array(Schema.Struct({ role: Schema.String, content: Schema.Json }));
const JsonText = Schema.fromJsonString(Schema.Json);
const JsonArray = Schema.Array(Schema.Json);
const JsonFields = Schema.Record(Schema.String, Schema.Json);

const AcceptedReceipt = Schema.Struct({
  status: Schema.Literal('accepted'),
  digest: Schema.String,
  submittedAt: Schema.String,
});

type AcceptedReceipt = typeof AcceptedReceipt.Type;
type ModelCall = ReturnType<ModelFixture['readCalls']>[number];

export async function gradesOnlyValidIsolatedEvaluations({ stack }: ScenarioInput): Promise<void> {
  const fixtures = requireFixtures(stack);
  const owner = await createAccount({ stack, login: fixtures.github.users.owner.login });
  const listed = await runCli({ stack, account: owner, args: ['workspace', 'list'], schema: WorkspaceList });
  const workspace = listed.workspaces.find((entry) => entry.name === 'Softmax');

  assert.ok(workspace !== undefined, 'The installation workspace must be visible to its owner');

  const account = { ...owner, workspaceId: workspace.id };
  const client = new Anthropic({ baseURL: stack.origin.origin, apiKey: account.token, maxRetries: 0 });
  const marker = `evaluation-${randomUUID()}`;
  const ungradedMarker = `ungraded-${randomUUID()}`;
  const quietMarker = `quiet-${randomUUID()}`;
  const expectation = `private-expectation-${randomUUID()}`;
  const criterionId = `criterion-${randomUUID()}`;
  const subjectInstructions = `subject-private-${randomUUID()}`;
  const suiteId = `suite-${randomUUID()}`;

  const caseIds = {
    graded: `graded-case-${randomUUID()}`,
    ungraded: `ungraded-case-${randomUUID()}`,
    quiet: `quiet-case-${randomUUID()}`,
  };

  const folder = await mkdtemp(join(stack.stateDirectory, 'eval-'));
  const suitePath = join(folder, 'suite.json');

  const suite = {
    version: 1,
    id: suiteId,
    subject: { model: MODEL, instructions: subjectInstructions },
    grader: { model: MODEL },
    self_grading: true,
    repeats: 1,
    trial_cap_micros: 1_000_000,
    cases: [
      { id: caseIds.graded, input: marker, expectations: [{ id: criterionId, description: expectation }] },
      { id: caseIds.ungraded, input: ungradedMarker, expectations: [{ id: criterionId, description: expectation }] },
      { id: caseIds.quiet, input: quietMarker, expectations: [{ id: criterionId, description: expectation }] },
    ],
  };

  await writeFile(suitePath, JSON.stringify(suite), { mode: 0o600 });

  const grade = {
    summary: 'The reply names a color',
    criteria: [{ id: criterionId, verdict: 'pass', evidence: 'Blue' }],
  };

  const conflictingGrade = {
    ...grade,
    criteria: [{ id: criterionId, verdict: 'fail', evidence: 'A replacement judgment' }],
  };

  const invalidGrade = { ...grade, criteria: [{ id: 'wrong-criterion', verdict: 'pass', evidence: 'Blue' }] };

  fixtures.model.configure({
    marker,
    replies: [
      { text: 'Blue' },
      submittedGrade(invalidGrade),
      submittedGrade(grade),
      submittedGrade(grade),
      submittedGrade(conflictingGrade),
      { text: JSON.stringify(conflictingGrade) },
    ],
  });
  fixtures.model.configure({ marker: ungradedMarker, replies: [{ text: 'Blue' }, { text: JSON.stringify(grade) }] });
  fixtures.model.configure({ marker: quietMarker, replies: [{ text: '' }] });

  const runMarkers = new Set([marker, ungradedMarker, quietMarker]);

  function readEvalCalls(): ReadonlyArray<ModelCall> {
    return fixtures.model.readCalls().filter((call) => runMarkers.has(call.marker));
  }

  function startEval(outFolder: string) {
    return startCli({
      stack,
      account,
      args: ['eval', 'run', '--suite', suitePath, '--out-folder', outFolder, '--workspace', account.workspaceId],
    });
  }

  const historicalFolder = join(folder, 'historical-out');
  const historicalReportPath = join(historicalFolder, 'report.json');
  const historicalReport = `${JSON.stringify({ format: 1, preserved: randomUUID() })}\n`;

  await mkdir(historicalFolder);
  await writeFile(historicalReportPath, historicalReport, { mode: 0o600 });

  const refused = startEval(historicalFolder);

  try {
    const result = await refused.finished;

    assert.equal(
      result.status,
      1,
      result.stdout.replaceAll(account.token, '[redacted]').slice(0, CLI_DIAGNOSTIC_MAX_CHARS),
    );
    assert.equal(
      await readFile(historicalReportPath, 'utf8'),
      historicalReport,
      'A new run rewrote historical report bytes',
    );

    const failure = Schema.decodeUnknownSync(RefusedEval)(result.stdout);

    assert.deepEqual(
      failure.errors.map((error) => error.code),
      ['EvalAdapterFailed'],
    );
    assert.equal(readEvalCalls().length, 0, 'Rejecting historical output started model work');
  } finally {
    await refused.stop();
  }

  const creationSuitePath = join(folder, 'creation-suite.json');
  const creationFolder = join(folder, 'creation-out');

  await writeFile(creationSuitePath, JSON.stringify({ ...suite, cases: suite.cases.slice(0, 1) }), { mode: 0o600 });

  const proxy = await creationResponseProxy({ origin: stack.origin });

  const interrupted = startCli({
    stack: { origin: proxy.origin, cli: stack.cli },
    account,
    args: [
      'eval',
      'run',
      '--suite',
      creationSuitePath,
      '--out-folder',
      creationFolder,
      '--workspace',
      account.workspaceId,
    ],
    environment: { MECHANE_API_KEY: account.token },
  });

  let diagnostic = '';

  try {
    const result = await interrupted.finished;

    assert.notEqual(result.status, 0, 'A lost creation response was reported as successful');
    assert.equal(proxy.state.failure, null);

    diagnostic = [result.stdout, result.stderr]
      .join('\n')
      .replaceAll(account.token, '[redacted]')
      .slice(0, CLI_DIAGNOSTIC_MAX_CHARS);
  } finally {
    await interrupted.stop();
    await proxy.stop();
  }

  const dropped = proxy.state.droppedAgent;

  assert.ok(dropped !== null, `The proxy did not receive an agent create. ${diagnostic}`);

  const creationId = dropped.metadata.eval_creation_id;

  async function readCreatedSubjects() {
    const subjects = [];

    for await (const agent of client.beta.agents.list({ include_archived: true })) {
      if (agent.metadata['eval_creation_id'] === creationId) {
        subjects.push({ id: agent.id, archivedAt: agent.archived_at });
      }
    }

    return subjects;
  }

  const recovered = await readCreatedSubjects();

  assert.equal(recovered.length, 1, 'Creation recovery duplicated the subject after its acknowledgement was lost');

  const [subject] = recovered;

  assert.ok(subject !== undefined);
  assert.equal(subject.id, dropped.id);
  assert.notEqual(subject.archivedAt, null, 'Creation recovery left an unowned subject active');

  const sessions = await client.beta.sessions.list({ agent_id: subject.id, include_archived: true });

  assert.deepEqual(sessions.data, [], 'Cleanup started a session for a lost agent creation');
  assert.equal(readEvalCalls().length, 0, 'Creation recovery started model work');

  let originalCalls: ReadonlyArray<ModelCall> = [];

  for (const repeat of [false, true]) {
    const command = startEval(join(folder, 'out'));

    try {
      const result = await command.finished;

      assert.equal(result.status, 1, JSON.stringify({ stdout: result.stdout, stderr: result.stderr }));

      const parsed = Schema.decodeUnknownResult(EvalOutput)(result.stdout);

      assert.ok(
        Result.isSuccess(parsed),
        JSON.stringify({
          status: result.status,
          stdout: result.stdout.slice(0, CLI_DIAGNOSTIC_MAX_CHARS),
          stderr: result.stderr.slice(0, CLI_DIAGNOSTIC_MAX_CHARS),
        }),
      );

      const report = parsed.success;

      assert.deepEqual(
        report.result.trials.map((trial) => [
          trial.caseId,
          trial.stages.grading,
          trial.quality.verdict ?? trial.quality.kind,
        ]),
        [
          [caseIds.graded, 'completed', 'pass'],
          [caseIds.ungraded, 'failed', 'unavailable'],
          [caseIds.quiet, 'ungradable', 'unavailable'],
        ],
        JSON.stringify({ progress: result.stderr, failures: report.result.trials.map((trial) => trial.failures) }),
      );

      const calls = readEvalCalls();

      if (repeat) {
        assert.deepEqual(calls, originalCalls, 'Resuming the evaluation started new model work');
      } else {
        originalCalls = calls;
      }

      const didExposeExpectation = calls
        .filter((call) => call.index === 0)
        .some((call) => [expectation, criterionId].some((secret) => JSON.stringify(call.body).includes(secret)));

      assert.equal(didExposeExpectation, false, 'A subject saw its grading expectation');

      const judgeCalls = calls.filter((call) => call.marker !== quietMarker && call.index > 0);

      assertJudgeCapabilities(judgeCalls);

      const firstJudge = judgeCalls.at(0);

      assert.ok(firstJudge !== undefined);

      const firstJudgeInput = JSON.stringify(firstJudge.body['messages']);

      assert.equal(
        [suiteId, ...Record.values(caseIds), subjectInstructions].some((secret) => firstJudgeInput.includes(secret)),
        false,
      );

      const finalGradeCall = judgeCalls.findLast((call) => call.marker === marker);

      assert.ok(finalGradeCall !== undefined);

      const messages = Schema.decodeUnknownSync(ModelMessages)(finalGradeCall.body['messages']);

      const receipts = messages
        .filter((message) => message.role === 'tool')
        .flatMap((message) => readAcceptedReceipts(message.content).slice(0, 1));

      assert.equal(
        receipts.length,
        ACCEPTED_SUBMISSIONS,
        'The valid grade and its exact retry must both receive a receipt',
      );
      assert.deepEqual(receipts.at(0), receipts.at(1), 'An exact grade retry changed its original receipt');
      assert.equal(JSON.stringify(finalGradeCall.body['messages']).includes('conflict'), true);

      assert.deepEqual(await readCreatedSubjects(), recovered);
    } finally {
      await command.stop();
    }
  }

  await gradesObservedToolEvidence({ stack, account, outFolder: join(folder, 'tool-out') });
}

function submittedGrade(input: Readonly<Record<string, unknown>>) {
  return { tools: [{ id: randomUUID(), name: SUBMIT_GRADE, input }] };
}

function assertJudgeCapabilities(calls: ReadonlyArray<ModelCall>): void {
  for (const call of calls) {
    const tools = Schema.decodeUnknownSync(OfferedTools)(call.body['tools']);

    assert.equal(tools.length, 1, 'A judge received capabilities beyond grade submission');
    assert.equal(
      tools.every((tool) => tool.function.name === SUBMIT_GRADE),
      true,
    );
  }
}

function readAcceptedReceipts(value: Schema.Json): ReadonlyArray<AcceptedReceipt> {
  const pending: Array<Schema.Json> = [value];
  const receipts: Array<AcceptedReceipt> = [];

  while (pending.length > 0) {
    const next = pending.pop();

    assert.ok(next !== undefined);

    const receipt = Schema.decodeUnknownResult(AcceptedReceipt)(next);

    if (Result.isSuccess(receipt)) {
      receipts.push(receipt.success);
    } else if (typeof next === 'string') {
      const parsed = Schema.decodeUnknownResult(JsonText)(next);

      if (Result.isSuccess(parsed)) {
        pending.push(parsed.success);
      }
    } else if (Array.isArray(next)) {
      const parts = Schema.decodeUnknownSync(JsonArray)(next);

      pending.push(...parts);
    } else if (next !== null && typeof next === 'object') {
      const fields = Schema.decodeUnknownSync(JsonFields)(next);

      pending.push(...Record.values(fields));
    }
  }

  return receipts;
}
