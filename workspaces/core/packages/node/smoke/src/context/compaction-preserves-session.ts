import { createManagedContext, requireFixtures, waitFor } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { message, waitForReply } from '../runs/session-messages.ts';

const TOOL_STEPS = 11;
const RESULT_BYTES = 24_576;
const MODEL_CONTEXT_BYTES = 131_072;

export async function compactionPreservesSession({ stack }: ScenarioInput): Promise<void> {
  const marker = randomUUID();
  const summary = `${marker} retained ${randomUUID()}`;
  const records = Array.from({ length: TOOL_STEPS }, () => randomUUID().padEnd(RESULT_BYTES, 'x'));
  const oldest = records[0];

  assert.ok(oldest !== undefined);

  const finalAnswer = randomUUID();
  const name = 'read_record';
  const { model } = requireFixtures(stack);

  const context = await createManagedContext({
    stack,
    name: marker,
    agent: {
      tools: [
        {
          type: 'custom',
          name,
          description: 'Read one record',
          input_schema: { type: 'object', properties: { offset: { type: 'integer' } }, required: ['offset'] },
        },
      ],
    },
  });

  const events = context.client.beta.sessions.events;
  const id = context.session.id;

  const replies = Array.from({ length: TOOL_STEPS }, (_, offset) => ({
    tools: [{ id: randomUUID(), name, input: { offset } }],
  }));

  model.configure({ marker, replies: [...replies, { text: finalAnswer }], summary });
  await events.send(id, { events: [message(marker)] });

  for (const [offset, text] of records.entries()) {
    const page = await waitFor({
      name: `the tool request for record ${offset}`,
      read: () => events.list(id, { types: ['agent.custom_tool_use'], order: 'desc', limit: 1 }),
      accept: (eventsPage) =>
        eventsPage.data.some((event) => event.type === 'agent.custom_tool_use' && event.input['offset'] === offset),
    });

    const tool = page.data[0];

    assert.ok(tool?.type === 'agent.custom_tool_use');
    await events.send(id, {
      events: [{ type: 'user.custom_tool_result', custom_tool_use_id: tool.id, content: [{ type: 'text', text }] }],
    });
  }

  await waitForReply(context, finalAnswer);

  const calls = model.readCalls({ marker });
  const generations = calls.filter((call) => call.purpose === 'generation');

  assert.equal(generations.length, TOOL_STEPS + 1);
  assert.ok(
    calls.some((call) => call.purpose === 'compaction'),
    'The fixture did not exercise compaction',
  );

  const activeContext = JSON.stringify(generations.at(-1)?.body['messages']);

  assert.ok(
    activeContext.includes(summary) && !activeContext.includes(oldest),
    'The final model request must use the committed summary in place of the oldest input',
  );
  assert.ok(
    generations.every((call) => Buffer.byteLength(JSON.stringify(call.body['messages'])) <= MODEL_CONTEXT_BYTES),
  );

  await stack.restart({ signal: 'SIGKILL' });

  const history = [];

  for await (const event of events.list(id, { limit: 20 })) {
    history.push(event);
  }

  assert.ok(history.some((event) => event.type === 'agent.thread_context_compacted'));

  const effects = history.filter((event) => event.type === 'user.custom_tool_result');

  assert.equal(effects.length, TOOL_STEPS);
  assert.equal(new Set(effects.map((event) => event.custom_tool_use_id)).size, TOOL_STEPS);
  assert.ok(
    effects.some((event) => event.content?.some((part) => part.type === 'text' && part.text.includes(oldest)) === true),
    'Compacting working context discarded an older result from session history',
  );

  const spans = history.filter((event) => event.type === 'span.model_request_end');

  assert.equal(spans.length, calls.length, 'A generation or compaction attempt has no usage record');

  const recorded = await context.client.beta.sessions.retrieve(id);

  assert.equal(
    recorded.usage.output_tokens,
    spans.reduce((sum, span) => sum + span.model_usage.output_tokens, 0),
  );
  assert.equal(model.readCalls({ marker }).length, calls.length, 'Reading history repeated paid work');
}
