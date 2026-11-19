import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { MANAGED_WORK_PATH } from '@mechane/sandbox-wire';
import { startHttpService } from '@mechane/stack';
import { requireFixtures, startCommandGate, waitFor, withInstalledContext } from '@mechane/testing';
import type { ManagedContext, ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const EXPECTED_MODEL_CALLS = 2;

/** Lose an accepted sandbox handoff, then restart the application while its shell is executing. */
export async function installedWorkerRecoversInterruptedCommand({ stack }: ScenarioInput): Promise<void> {
  const sandbox = stack.sandbox;

  assert.ok(sandbox !== undefined);

  const { model } = requireFixtures(stack);
  const marker = randomUUID();
  const gate = await startCommandGate({ stack });
  let hasDroppedAcknowledgement = false;

  const proxy = await startHttpService(async (request) => {
    const url = new URL(request.url);
    const forwarded = new Request(new URL(url.pathname + url.search, sandbox.origin), request);

    forwarded.headers.delete(HttpHeader.Host);

    const response = await fetch(forwarded, { redirect: 'manual' });

    const isLaunch = url.pathname === MANAGED_WORK_PATH && request.method === HttpMethod.Post;

    if (isLaunch && response.status === HttpStatusCode.Accepted && !hasDroppedAcknowledgement) {
      hasDroppedAcknowledgement = true;

      await response.body?.cancel();

      return new Response(null, { status: HttpStatusCode.BadGateway });
    }

    return response;
  });

  async function observeRecovery({ client, session }: ManagedContext): Promise<void> {
    const command = `printf '%s\\n' '${marker}' >> effects && curl --fail --silent '${gate.url}' && cat effects`;

    model.configure({
      marker,
      replies: [{ tools: [{ id: randomUUID(), name: 'bash', input: { command } }] }, { text: 'The shell finished' }],
    });
    await client.beta.sessions.events.send(session.id, {
      events: [{ type: 'user.message', content: [{ type: 'text', text: marker }] }],
    });

    await Promise.all([
      gate.waitForRequest({ count: 1 }),
      waitFor({
        name: 'the accepted sandbox launch response to be lost',
        read: async () => hasDroppedAcknowledgement,
        accept: (observed) => observed,
      }),
    ]);
    await stack.restart({ signal: 'SIGKILL' });
    gate.release();

    const page = await waitFor({
      name: 'the installed worker result after restart',
      read: () => client.beta.sessions.events.list(session.id),
      accept: (history) => history.data.some((event) => event.type === 'agent.message'),
    });

    const uses = page.data.filter((event) => event.type === 'agent.tool_use');
    const results = page.data.filter((event) => event.type === 'user.tool_result');

    assert.equal(uses.length, 1);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.tool_use_id, uses[0]?.id);
    assert.notEqual(results[0]?.is_error, true, 'The installed worker reported a shell failure');

    const output =
      results[0]?.content
        ?.filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n') ?? '';

    assert.equal(output.split(marker).length - 1, 1, 'The shell output lost or repeated the recorded effect');
    assert.equal(gate.readRequests().length, 1, 'A resumed command repeated its external effect');
    assert.equal(model.readCalls({ marker }).length, EXPECTED_MODEL_CALLS, 'Restart repeated model work');
  }

  try {
    await stack.restart({ environment: { MECHANE_SANDBOX_ORIGIN: proxy.origin.origin } });
    await withInstalledContext({
      stack,
      name: marker,
      run: async (context) => {
        try {
          await observeRecovery(context);
        } finally {
          gate.release();
        }
      },
    });
  } finally {
    try {
      await stack.restart({ environment: { MECHANE_SANDBOX_ORIGIN: sandbox.origin.origin } });
    } finally {
      await Promise.all([gate.close(), proxy.close()]);
    }
  }
}
