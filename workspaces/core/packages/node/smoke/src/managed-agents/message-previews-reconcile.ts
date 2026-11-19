import type { BetaManagedAgentsStreamSessionEvents } from '@anthropic-ai/sdk/resources/beta/sessions';
import { createManagedContext, requireFixtures } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const timeoutMs = 30_000;
const previewTypes: ReadonlySet<string> = new Set(['event_start', 'event_delta']);
type Event = BetaManagedAgentsStreamSessionEvents;

async function readReply(stream: AsyncIterable<Event>, observe?: (event: Event) => void) {
  const frames: Array<Event> = [];
  let hasAnswer = false;

  for await (const frame of stream) {
    frames.push(frame);
    observe?.(frame);

    if (frame.type === 'session.error') {
      throw new Error(`Session failed before responding: ${JSON.stringify(frame.error)}`);
    }

    if (frame.type === 'agent.message') {
      hasAnswer = true;
    }

    if (hasAnswer && frame.type === 'span.model_request_end') {
      return frames;
    }
  }

  throw new Error('The stream ended before the model request completed');
}

export async function messagePreviewsReconcile({ stack }: ScenarioInput) {
  const { model } = requireFixtures(stack);
  const marker = randomUUID();
  const privateThinking = `private-${marker}`;
  const begin = 'Answer starts here';
  const ending = ' and finishes here.';
  const toolName = 'get_report';

  model.configure({
    marker,
    replies: [
      { tools: [{ id: 'fixture-report', name: toolName, input: {} }] },
      { holdAfterPrefix: { text: begin, thinking: privateThinking }, text: ending },
    ],
  });

  const { client, session } = await createManagedContext({
    stack,
    name: marker,
    agent: {
      tools: [{ type: 'custom', name: toolName, description: 'Get a report', input_schema: { type: 'object' } }],
    },
  });

  const stop = new AbortController();
  const signal = AbortSignal.any([stop.signal, AbortSignal.timeout(timeoutMs)]);
  const prefix = Promise.withResolvers<void>();

  const enabled = await client.beta.sessions.events.stream(
    session.id,
    { event_deltas: ['agent.message', 'agent.thinking'] },
    { signal },
  );

  const ordinary = await client.beta.sessions.events.stream(session.id, {}, { signal });
  const awaitingResult = Promise.withResolvers<string>();

  const reads = [
    readReply(enabled, (frame) => {
      if (frame.type === 'event_delta') {
        prefix.resolve();
      }

      if (frame.type === 'session.status_idle' && frame.stop_reason.type === 'requires_action') {
        const [id] = frame.stop_reason.event_ids;

        if (id !== undefined) {
          awaitingResult.resolve(id);
        }
      }
    }),
    readReply(ordinary),
  ];

  try {
    await client.beta.sessions.events.send(session.id, {
      events: [{ type: 'user.message', content: [{ type: 'text', text: marker }] }],
    });

    const earlyEnd = Promise.all(reads).then(() => {
      throw new Error('The model completed before its held answer was released');
    });

    const id = await Promise.race([awaitingResult.promise, earlyEnd]);

    await client.beta.sessions.events.send(session.id, {
      events: [{ type: 'user.custom_tool_result', custom_tool_use_id: id, content: [{ type: 'text', text: 'Ready' }] }],
    });
    await Promise.race([prefix.promise, earlyEnd]);

    const reconnect = await client.beta.sessions.events.stream(
      session.id,
      { event_deltas: ['agent.message'] },
      { signal },
    );

    reads.push(readReply(reconnect));
    model.release({ marker, index: 1 });

    const [events, baseline, late] = await Promise.all(reads);

    assert.ok(events !== undefined && baseline !== undefined && late !== undefined);

    const message = events.find((frame) => frame.type === 'agent.message');

    assert.ok(message !== undefined);
    assert.deepEqual(message.content, [{ type: 'text', text: begin + ending }]);

    const starts = events.filter((frame) => frame.type === 'event_start');

    assert.equal(starts.filter((start) => start.event.type === 'agent.message').length, 1);
    assert.equal(starts.find((start) => start.event.type === 'agent.message')?.event.id, message.id);

    const thinking = events.find((frame) => frame.type === 'agent.thinking');

    assert.ok(thinking !== undefined);
    assert.equal(starts.filter((start) => start.event.type === 'agent.thinking').length, 1);
    assert.equal(starts.find((start) => start.event.type === 'agent.thinking')?.event.id, thinking.id);

    const allDeltas = events.filter((frame) => frame.type === 'event_delta');

    assert.ok(allDeltas.every((frame) => frame.event_id === message.id));

    const text = allDeltas.map((frame) => frame.delta.content.text).join('');

    assert.ok(text.startsWith(begin) && (begin + ending).startsWith(text));

    const lastDelta = allDeltas.at(-1);

    assert.ok(lastDelta !== undefined && events.indexOf(message) > events.indexOf(lastDelta));
    assert.ok(!JSON.stringify(events).includes(privateThinking));

    for (const feed of [baseline, late]) {
      assert.ok(feed.every((frame) => !previewTypes.has(frame.type)));
      assert.equal(feed.find((frame) => frame.type === 'agent.message')?.id, message.id);
    }

    const history = await client.beta.sessions.events.list(session.id);

    assert.ok(history.data.some((frame) => frame.id === message.id));
    assert.ok(!JSON.stringify(history.data).includes(privateThinking));
  } finally {
    model.release({ marker, index: 1 });
    stop.abort();
    await Promise.allSettled(reads);
  }
}
