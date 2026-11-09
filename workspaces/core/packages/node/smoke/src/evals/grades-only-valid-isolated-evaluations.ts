import { createAccount, requireFixtures, startCli } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const EXPECTED_MODEL_CALLS = 9;
const SUBJECT_MODEL_CALLS = 2;

const EvalEnvelope = Schema.Struct({
  result: Schema.Struct({ trials: Schema.Array(Schema.Struct({ case_id: Schema.String, verdict: Schema.String })) }),
});

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
