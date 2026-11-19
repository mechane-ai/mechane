import { createManagedContext, requireFixtures, waitFor } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const EXPECTED_MODEL_CALLS = 4;

export async function outcomesReviseAndSettle({ stack }: ScenarioInput): Promise<void> {
  const { model } = requireFixtures(stack);
  const marker = randomUUID();
  const privateInstruction = randomUUID();
  const feedback = 'Include the implementation date.';

  model.configure({
    marker,
    replies: [
      { text: 'Release notes' },
      { text: JSON.stringify({ result: 'needs_revision', explanation: feedback }) },
      { text: 'Release notes for 2026-11-19' },
      { text: JSON.stringify({ result: 'satisfied', explanation: 'The release notes include the date.' }) },
    ],
  });

  const { client, session } = await createManagedContext({
    stack,
    name: marker,
    agent: { system: privateInstruction },
    session: {
      initial_events: [
        {
          type: 'user.define_outcome',
          description: `Produce release notes for ${marker}`,
          rubric: { type: 'text', content: 'The release notes include the date.' },
        },
      ],
    },
  });

  const done = await waitFor({
    name: 'an independently regraded outcome reaches idle',
    read: () => client.beta.sessions.retrieve(session.id),
    accept: (value) => value.status === 'idle' && value.outcome_evaluations[0]?.result === 'satisfied',
  });

  const evaluation = done.outcome_evaluations[0];

  assert.ok(evaluation !== undefined && evaluation.completed_at !== null);
  assert.equal(evaluation.iteration, 1);

  const history = [];

  for await (const event of client.beta.sessions.events.list(session.id, { limit: 2, order: 'asc' })) {
    history.push(event);
  }

  const starts = history.filter((event) => event.type === 'span.outcome_evaluation_start');
  const ends = history.filter((event) => event.type === 'span.outcome_evaluation_end');

  assert.deepEqual(
    ends.map((event) => event.result),
    ['needs_revision', 'satisfied'],
  );
  assert.deepEqual(
    ends.map((event) => event.outcome_evaluation_start_id),
    starts.map((event) => event.id),
  );
  assert.ok(ends.every((event) => event.outcome_id === evaluation.outcome_id && event.usage.output_tokens > 0));
  assert.deepEqual(
    history.filter((event) => event.type === 'agent.message').map((event) => event.content),
    [[{ type: 'text', text: 'Release notes' }], [{ type: 'text', text: 'Release notes for 2026-11-19' }]],
  );

  const calls = model.readCalls({ marker }).map((call) => JSON.stringify(call.body));

  assert.equal(calls.length, EXPECTED_MODEL_CALLS);
  assert.ok(calls[0]?.includes(privateInstruction) === true && calls[2]?.includes(feedback) === true);
  assert.ok(calls[1]?.includes(privateInstruction) === false && calls[3]?.includes(privateInstruction) === false);
}
