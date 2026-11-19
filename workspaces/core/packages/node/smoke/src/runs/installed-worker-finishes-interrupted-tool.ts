import { HttpStatusCode } from '@mechane/records';
import { startHttpService } from '@mechane/stack';
import { closeInstalledContext, createInstalledContext, requireFixtures, startCommandGate } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { message, waitForReply } from './session-messages.ts';

export async function installedWorkerFinishesInterruptedTool({ stack }: ScenarioInput): Promise<void> {
  const sandbox = stack.sandbox;

  assert.ok(sandbox !== undefined);

  const { model } = requireFixtures(stack);
  const marker = randomUUID();
  const redirected = randomUUID();
  const finalAnswer = randomUUID();

  const context = await createInstalledContext({ stack, name: marker });
  const events = context.client.beta.sessions.events;
  const id = context.session.id;
  const gate = await startCommandGate({ stack });
  const unavailable = await startHttpService(async () => new Response(null, { status: HttpStatusCode.Unavailable }));

  try {
    const command = `printf '%s\\n' '${marker}' >> effects && curl --fail --silent '${gate.url}' && cat effects`;

    model.configure({ marker, replies: [{ tools: [{ id: randomUUID(), name: 'bash', input: { command } }] }] });
    model.configure({ marker: redirected, replies: [{ text: finalAnswer }] });
    await events.send(id, { events: [message(marker)] });
    await gate.waitForRequest({ count: 1 });
    await stack.restart({ environment: { MECHANE_SANDBOX_ORIGIN: unavailable.origin.origin } });

    const accepted = await events.send(id, { events: [{ type: 'user.interrupt' }, message(redirected)] });
    const interrupt = accepted.data?.[0];

    assert.ok(interrupt?.type === 'user.interrupt');
    await stack.restart({ signal: 'SIGKILL', environment: { MECHANE_SANDBOX_ORIGIN: sandbox.origin.origin } });

    const pending = await events.list(id, { types: ['user.interrupt'] });

    assert.ok(
      pending.data.some((event) => event.id === interrupt.id && event.processed_at === null),
      'The session acknowledged cancellation while the guest command was still running',
    );
    assert.equal(model.readCalls({ marker: redirected }).length, 0);

    gate.release();
    await waitForReply(context, finalAnswer);

    const history = [];

    for await (const event of events.list(id)) {
      history.push(event);
    }

    const uses = history.filter((event) => event.type === 'agent.tool_use');
    const results = history.filter((event) => event.type === 'user.tool_result');

    assert.equal(uses.length, 1);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.tool_use_id, uses[0]?.id);
    assert.notEqual(results[0]?.is_error, true);

    const output = results[0]?.content
      ?.filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n');

    assert.ok(output !== undefined && output.includes(marker), 'The actual shell receipt lost the recorded effect');
    assert.equal(output.indexOf(marker), output.lastIndexOf(marker), 'The shell receipt repeated the effect');
    assert.equal(gate.readRequests().length, 1);
    assert.equal(model.readCalls({ marker }).length, 1);
  } finally {
    gate.release();

    try {
      await stack.restart({ environment: { MECHANE_SANDBOX_ORIGIN: sandbox.origin.origin } });
      await closeInstalledContext(context);
    } finally {
      await Promise.all([gate.close(), unavailable.close()]);
    }
  }
}
