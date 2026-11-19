import { HttpStatusCode } from '@mechane/records';
import { createManagedContext, requireFixtures, waitFor } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readSessionEvents } from './read-session-events.ts';

export async function sessionFailureRemainsInspectable({ stack }: ScenarioInput): Promise<void> {
  const { model } = requireFixtures(stack);
  const secret = `private-provider-error-${randomUUID()}`;
  const metadata = `unrecognized-private-field-${randomUUID()}`;

  const streamError = {
    code: HttpStatusCode.TooManyRequests,
    type: 'rate_limit_error',
    message: `${model.apiKey} ${secret}`,
    param: metadata,
    metadata: { unexpected_detail: metadata },
  };

  const failures = [{ status: HttpStatusCode.BadRequest }, { status: HttpStatusCode.Unavailable }, { streamError }];

  const {
    client,
    agent,
    environment,
    session: initialSession,
  } = await createManagedContext({ stack, name: randomUUID() });

  for (const [index, failure] of failures.entries()) {
    const marker = `provider-failure-${randomUUID()}`;
    let session = initialSession;

    if (index > 0) {
      session = await client.beta.sessions.create({ agent: agent.id, environment_id: environment.id });
    }

    model.configure({ marker, replies: Array.from({ length: 3 }, () => failure) });
    await client.beta.sessions.events.send(session.id, {
      events: [{ type: 'user.message', content: [{ type: 'text', text: marker }] }],
    });

    const completed = await waitFor({
      name: 'a terminal, inspectable provider error',
      read: () => client.beta.sessions.events.list(session.id, { types: ['session.error'] }),
      accept: (page) =>
        page.data.some((entry) => entry.type === 'session.error' && entry.error.retry_status.type !== 'retrying'),
    });

    const terminal = completed.data.find(
      (entry) => entry.type === 'session.error' && entry.error.retry_status.type !== 'retrying',
    );

    assert.ok(terminal?.type === 'session.error');
    assert.equal(terminal.error.retry_status.type, 'exhausted');
    assert.ok(terminal.error.message.length > 0);

    if ('streamError' in failure) {
      assert.equal(terminal.error.type, 'model_rate_limited_error');
    }

    const attempts = model.readCalls({ marker });

    assert.ok(attempts.length > 0);

    if (failure.status === HttpStatusCode.Unavailable) {
      assert.ok(attempts.length > 1, 'Transient provider failure did not exercise native retries');
    }

    const spans = await readSessionEvents({
      client,
      id: session.id,
      query: { types: ['span.model_request_start', 'span.model_request_end'] },
    });

    const starts = spans.filter((entry) => entry.type === 'span.model_request_start').map((entry) => entry.id);
    const ends = spans.filter((entry) => entry.type === 'span.model_request_end');

    assert.equal(starts.length, attempts.length, 'A paid provider attempt has no start receipt');
    assert.equal(new Set(starts).size, attempts.length);
    assert.equal(ends.length, attempts.length);
    assert.deepEqual(new Set(ends.map((entry) => entry.model_request_start_id)), new Set(starts));
    assert.ok(ends.every((entry) => entry.is_error === true));

    const [storage, log] = await Promise.all([stack.dumpStorage(), readFile(stack.serverLog, 'utf8')]);

    const surfaces = [
      storage,
      log,
      JSON.stringify({ errors: completed.data, spans }),
      JSON.stringify(attempts.map((call) => call.body)),
    ];

    const representations = [model.apiKey, secret, metadata].flatMap((canary) => {
      const bytes = Buffer.from(canary);

      return [canary, bytes.toString('hex'), bytes.toString('base64')];
    });

    const retained = surfaces.some((surface) => representations.some((canary) => surface.includes(canary)));

    assert.equal(retained, false, 'Provider failure retained private data');

    await stack.restart({ signal: 'SIGKILL' });

    const replay = await client.beta.sessions.events.list(session.id, { types: ['session.error'] });

    assert.deepEqual(replay.data, completed.data);
    assert.deepEqual(
      await readSessionEvents({
        client,
        id: session.id,
        query: { types: ['span.model_request_start', 'span.model_request_end'] },
      }),
      spans,
    );

    const replies = await client.beta.sessions.events.list(session.id, { types: ['agent.message'] });

    assert.equal(replies.data.length, 0);
    assert.equal(
      model.readCalls({ marker }).length,
      attempts.length,
      'Reading the failed session replayed a paid request',
    );
  }
}
