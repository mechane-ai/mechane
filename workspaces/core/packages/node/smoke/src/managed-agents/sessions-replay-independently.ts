import type Anthropic from '@anthropic-ai/sdk';
import type { BetaManagedAgentsUserMessageEventParams } from '@anthropic-ai/sdk/resources/beta/sessions/events';
import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { createManagedContext, requireFixtures, waitFor } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const streamTimeoutMs = 15_000;

export async function sessionsReplayIndependently({ stack }: ScenarioInput): Promise<void> {
  const { model } = requireFixtures(stack);
  const marker = randomUUID();
  const firstPrompt = `hold ${marker}`;
  const otherPrompt = `reply ${marker}`;
  const document = Buffer.from(`%PDF-1.7\n% ${marker}\n%%EOF`).toString('base64');
  const otherReply = `only-session-two-${marker}`;

  model.configure({ marker: firstPrompt, replies: [{ text: firstPrompt, isHeld: true }] });
  model.configure({ marker: otherPrompt, replies: [{ text: otherReply }] });

  const { client, agent, environment, session: first } = await createManagedContext({ stack, name: marker });
  const other = await client.beta.sessions.create({ agent: agent.id, environment_id: environment.id });

  assert.notEqual(first.id, other.id);
  await client.beta.sessions.events.send(first.id, {
    events: [{ type: 'user.message', content: [{ type: 'text', text: firstPrompt }] }],
  });
  await model.waitForCall({ marker: firstPrompt, index: 0 });

  try {
    const reference = `reference-${marker}`;
    const url = new URL(reference, 'https://example.invalid/').href;

    const content: BetaManagedAgentsUserMessageEventParams['content'] = [
      { type: 'text', text: otherPrompt },
      { type: 'document', source: { type: 'base64', media_type: MediaType.Pdf, data: document } },
      { type: 'document', source: { type: 'url', url } },
      { type: 'image', source: { type: 'url', url } },
      { type: 'image', source: { type: 'file', file_id: reference } },
    ];

    await assert.rejects(
      client.beta.sessions.events.send(other.id, {
        events: [
          { type: 'user.message', content: [{ type: 'document', source: { type: 'file', file_id: reference } }] },
        ],
      }),
      { status: HttpStatusCode.BadRequest },
    );

    const receiptId = await observeLiveInput(client, other.id, content);

    assert.equal(model.readCalls({ marker: otherPrompt }).length, 0);
    await client.beta.sessions.events.send(first.id, { events: [{ type: 'user.interrupt' }] });
    model.release({ marker: firstPrompt, index: 0 });
    await waitFor({
      name: 'the second session’s answer after interrupting the first',
      read: async () => {
        const answers = await client.beta.sessions.events.list(other.id, { types: ['agent.message'] });

        return answers.data.filter((event) => event.type === 'agent.message').flatMap((event) => event.content);
      },
      accept: (blocks) => blocks.some((block) => block.type === 'text' && block.text === otherReply),
    });
    await stack.restart();

    const history = [];

    for await (const event of client.beta.sessions.events.list(other.id, { limit: 1 })) {
      history.push(event);
    }

    assert.equal(new Set(history.map((event) => event.id)).size, history.length);

    const inputs = history.filter((event) => event.type === 'user.message');

    assert.equal(inputs.length, 1);
    assert.partialDeepStrictEqual(inputs, [{ type: 'user.message', id: receiptId, content }]);
    assert.ok(!JSON.stringify(history).includes(firstPrompt));

    const interrupted = [];

    for await (const event of client.beta.sessions.events.list(first.id, { limit: 1 })) {
      interrupted.push(event);
    }

    assert.ok(interrupted.some((event) => event.type === 'user.interrupt'));
    assert.ok(!JSON.stringify(interrupted).includes(otherReply));

    const modelCall = model.readCalls({ marker: otherPrompt })[0];

    assert.ok(modelCall !== undefined);

    const wire = JSON.stringify(modelCall.body);

    assert.ok(!wire.includes(firstPrompt));
    assert.ok(!wire.includes(reference));
    assert.partialDeepStrictEqual(modelCall.body, {
      messages: [
        { role: 'user', content: [{ type: 'file', file: { file_data: `data:${MediaType.Pdf};base64,${document}` } }] },
      ],
    });

    const changed = await client.beta.sessions.update(first.id, { title: marker, agent: { tools: [] } });

    assert.equal(changed.title, marker);

    const edits = await client.beta.sessions.events.list(first.id, { types: ['session.updated'] });

    assert.equal(edits.data.length, 1);
    assert.partialDeepStrictEqual(edits.data[0], { type: 'session.updated', title: marker, agent: { tools: [] } });

    const archived = await client.beta.sessions.archive(first.id);

    assert.equal(archived.status, 'terminated');

    const resumed = await verifySseResume({
      origin: stack.origin,
      token: client.apiKey ?? '',
      sessionId: other.id,
      lastEventId: receiptId,
    });

    assert.ok(resumed.some((event) => event.type === 'agent.message'));

    const deleteStream = await client.beta.sessions.events.stream(
      first.id,
      {},
      { signal: AbortSignal.timeout(streamTimeoutMs) },
    );

    const deletedPromise = client.beta.sessions.delete(first.id);
    const deleteEvents = [];

    for await (const event of deleteStream) {
      deleteEvents.push(event);
    }

    const deleted = await deletedPromise;

    assert.equal(deleted.type, 'session_deleted');
    assert.ok(deleteEvents.some((event) => event.type === 'session.deleted'));
    await assert.rejects(client.beta.sessions.events.list(first.id), { status: HttpStatusCode.NotFound });

    const survivingEvents = await client.beta.sessions.events.list(other.id, { types: ['user.message'] });

    assert.ok(survivingEvents.data.some((event) => event.id === receiptId));
  } finally {
    model.release({ marker: firstPrompt, index: 0 });
  }
}

async function observeLiveInput(
  client: Anthropic,
  sessionId: string,
  content: BetaManagedAgentsUserMessageEventParams['content'],
): Promise<string> {
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(streamTimeoutMs)]);

  try {
    const stream = await client.beta.sessions.events.stream(sessionId, {}, { signal });
    const receipt = await client.beta.sessions.events.send(sessionId, { events: [{ type: 'user.message', content }] });
    const accepted = receipt.data?.[0];

    assert.ok(accepted !== undefined);

    for await (const event of stream) {
      if (event.type === 'user.message' && event.id === accepted.id) {
        return accepted.id;
      }
    }

    assert.fail('The live stream ended without the accepted input event');
  } finally {
    controller.abort();
  }
}

type ResumeInput = {
  readonly origin: URL;
  readonly token: string;
  readonly sessionId: string;
  readonly lastEventId: string;
};

function parseSseFrame(frame: string): { readonly id: string; readonly type: string } | null {
  const lines = frame.split('\n');
  const idLine = lines.find((line) => line.startsWith('id: '));
  const eventLine = lines.find((line) => line.startsWith('event: '));

  if (idLine === undefined || eventLine === undefined) {
    return null;
  }

  return { id: idLine.slice('id: '.length), type: eventLine.slice('event: '.length) };
}

type SseFrame = { readonly id: string; readonly type: string };

function consumeSseFrames(
  frames: ReadonlyArray<string>,
  lastEventId: string,
): { readonly hasRetry: boolean; readonly events: ReadonlyArray<SseFrame> } {
  const hasRetry = frames.some((frame) => frame.includes('retry: 3000'));
  const events: Array<SseFrame> = [];

  for (const frame of frames) {
    const parsed = parseSseFrame(frame);

    if (parsed !== null) {
      assert.notEqual(parsed.id, lastEventId);
      events.push(parsed);
    }
  }

  return { hasRetry, events };
}

async function verifySseResume({
  origin,
  token,
  sessionId,
  lastEventId,
}: ResumeInput): Promise<ReadonlyArray<SseFrame>> {
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(streamTimeoutMs)]);

  try {
    const response = await fetch(new URL(`/v1/sessions/${sessionId}/events/stream`, origin), {
      headers: {
        [HttpHeader.ApiKey]: token,
        [HttpHeader.AnthropicVersion]: '2026-10-21',
        [HttpHeader.AnthropicBeta]: 'managed-agents-2026-04-01',
        [HttpHeader.LastEventId]: lastEventId,
      },
      signal,
    });

    assert.equal(response.status, HttpStatusCode.Ok);
    assert.equal(response.headers.get(HttpHeader.XAccelBuffering), 'no');
    assert.ok(response.body !== null);

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    const collected: Array<SseFrame> = [];
    let hasRetry = false;
    let buffer = '';

    while (!signal.aborted) {
      const chunk = await reader.read();

      if (chunk.done) {
        break;
      }

      buffer += chunk.value;

      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      const batch = consumeSseFrames(frames, lastEventId);
      hasRetry ||= batch.hasRetry;

      collected.push(...batch.events);

      if (batch.events.some((event) => event.type === 'agent.message')) {
        assert.ok(hasRetry);

        return collected;
      }
    }

    assert.fail('SSE Last-Event-ID resume did not replay agent.message');
  } finally {
    controller.abort();
  }
}
