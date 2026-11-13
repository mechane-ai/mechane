import { createAccount, requireFixtures, runCli, startCli } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { creationResponseProxy } from './creation-response-proxy.ts';

const EXPECTED_MODEL_CALLS = 9;
const SUBJECT_MODEL_CALLS = 2;

const EvalEnvelope = Schema.Struct({
  result: Schema.Struct({ trials: Schema.Array(Schema.Struct({ case_id: Schema.String, verdict: Schema.String })) }),
});

const Plan = Schema.Struct({ trials: Schema.Array(Schema.Struct({ id: Schema.String })) });
const MechList = Schema.Struct({ mechs: Schema.Array(Schema.Struct({ id: Schema.String, name: Schema.String })) });

export async function gradesOnlyValidIsolatedEvaluations({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const fixtures = requireFixtures(stack);
  const marker = `evaluation-${randomUUID()}`;
  const ungradedMarker = `ungraded-${randomUUID()}`;
  const quietMarker = `quiet-${randomUUID()}`;
  const expectation = `private-expectation-${randomUUID()}`;
  const folder = await mkdtemp(join(stack.stateDirectory, 'eval-'));
  const suitePath = join(folder, 'suite.json');

  const suite = {
    version: 1,
    id: marker,
    subject: {},
    grader: {},
    self_grading: true,
    repeats: 1,
    trial_cap_micros: 1_000_000,
    cases: [
      { id: 'graded', input: marker, expectations: [{ id: 'color', description: expectation }] },
      { id: 'ungraded', input: ungradedMarker, expectations: [{ id: 'color', description: expectation }] },
      { id: 'quiet', input: quietMarker, expectations: [{ id: 'color', description: expectation }] },
    ],
  };

  await writeFile(suitePath, JSON.stringify(suite), { mode: 0o600 });
  fixtures.model.configure({
    marker,
    replies: [
      ...publishedReply('Blue'),
      ...publishedReply(
        JSON.stringify({
          summary: 'The reply names a color',
          criteria: [{ id: 'color', verdict: 'pass', evidence: 'Blue' }],
        }),
      ),
    ],
  });
  fixtures.model.configure({
    marker: ungradedMarker,
    replies: [...publishedReply('Blue'), ...publishedReply('This is not a structured grade')],
  });
  fixtures.model.configure({ marker: quietMarker, replies: [{ text: 'This private text is not an answer' }] });

  const args = [
    'eval',
    'run',
    '--suite',
    suitePath,
    '--out-folder',
    join(folder, 'out'),
    '--workspace',
    account.workspaceId,
  ];

  const proxy = await creationResponseProxy({ origin: stack.origin, workspaceId: account.workspaceId });

  const interrupted = startCli({
    stack: { origin: proxy.origin, cli: stack.cli },
    account,
    args,
    environment: { MECHANE_API_KEY: account.token },
  });

  try {
    const result = await interrupted.finished;

    assert.notEqual(result.status, 0, 'A lost creation response was reported as successful');
    assert.equal(proxy.state.failure, null);
    assert.equal(proxy.state.isDropped, true, 'The creation response was not dropped');
  } finally {
    await interrupted.stop();
    await proxy.stop();
  }

  const plan = Schema.decodeUnknownSync(Schema.fromJsonString(Plan))(
    await readFile(join(folder, 'out', 'plan.json'), 'utf8'),
  );

  const firstTrial = plan.trials[0];

  assert.ok(firstTrial !== undefined);

  const subjectName = `subject ${firstTrial.id}`;

  const first = await runCli({
    stack,
    account,
    args: ['mech', 'list', '--workspace', account.workspaceId],
    schema: MechList,
  });

  const created = first.mechs.filter((mech) => mech.name === subjectName);

  assert.equal(created.length, 1, 'The interrupted creation did not leave one identifiable subject');

  for (const repeat of [false, true]) {
    const command = startCli({ stack, account, args });

    try {
      const result = await command.finished;

      assert.equal(result.status, 1, JSON.stringify({ stdout: result.stdout, stderr: result.stderr }));

      const report = Schema.decodeUnknownSync(Schema.fromJsonString(EvalEnvelope))(result.stdout);

      assert.deepEqual(
        report.result.trials.map((trial) => [trial.case_id, trial.verdict]),
        [
          ['graded', 'pass'],
          ['ungraded', 'no_grade'],
          ['quiet', 'no_reply'],
        ],
      );

      const calls = fixtures.model
        .readCalls()
        .filter((call) => call.marker === marker || call.marker === ungradedMarker || call.marker === quietMarker);

      assert.equal(calls.length, EXPECTED_MODEL_CALLS, `The evaluation ${String(repeat)} repeated model work`);

      const didExposeExpectation = calls
        .filter((call) => call.index < SUBJECT_MODEL_CALLS)
        .some((call) => JSON.stringify(call.body).includes(expectation));

      assert.equal(didExposeExpectation, false, 'A subject saw its grading expectation');

      const listed = await runCli({
        stack,
        account,
        args: ['mech', 'list', '--workspace', account.workspaceId],
        schema: MechList,
      });

      assert.deepEqual(
        listed.mechs.filter((mech) => mech.name === subjectName),
        created,
      );
    } finally {
      await command.stop();
    }
  }
}

function publishedReply(text: string) {
  return [
    { tools: [{ id: randomUUID(), name: 'console_message', input: { text } }] },
    { text: 'The publication is complete' },
  ];
}
