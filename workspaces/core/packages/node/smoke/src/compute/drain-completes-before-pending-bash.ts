import { HttpHeader, HttpMethod } from '@mechane/records';
import {
  InstalledDrainReport,
  SANDBOX_INSTALLED_DRAIN_PATH,
  SandboxReport,
  SandboxStopPhase,
} from '@mechane/sandbox-wire';
import {
  readInstalledComputer,
  requireFixtures,
  runInstalledBash,
  startCommandGate,
  waitFor,
  waitForInstalledRelease,
  withInstalledContext,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { posix } from 'node:path';

const EVENT_PAGE_ROWS = 100;
const RELEASE_TIMEOUT_MS = 300_000;

export async function drainCompletesBeforePendingBash({ stack }: ScenarioInput): Promise<void> {
  const sandbox = stack.sandbox;

  assert.ok(sandbox !== undefined);

  await withInstalledContext({
    stack,
    name: `drain-bash-${randomUUID()}`,
    run: async (context) => {
      const gate = await startCommandGate({ stack });
      const first = randomUUID();
      const later = randomUUID();
      const filename = `ordering-${first}`;
      const { model } = requireFixtures(stack);
      const heldCommand = `curl --fail --silent '${gate.url}' && printf 'first\\n' >> '${filename}'`;
      const nextCommand = `printf 'later\\n' >> '${filename}'`;
      const commands = [heldCommand, nextCommand];

      try {
        model.configure({
          marker: first,
          replies: [{ tools: [{ id: randomUUID(), name: 'bash', input: { command: heldCommand } }] }, { text: first }],
        });
        model.configure({
          marker: later,
          replies: [{ tools: [{ id: randomUUID(), name: 'bash', input: { command: nextCommand } }] }, { text: later }],
        });

        const admitted = await context.client.beta.sessions.events.send(context.session.id, {
          events: [first, later].map((text) => ({ type: 'user.message', content: [{ type: 'text', text }] })),
        });

        assert.equal(admitted.data?.length, commands.length);
        await gate.waitForRequest({ count: 1 });

        const queuedId = admitted.data.at(-1)?.id;
        const held = await context.client.beta.sessions.events.list(context.session.id, { limit: EVENT_PAGE_ROWS });
        const queued = held.data.find((event) => event.id === queuedId);

        assert.ok(queued?.type === 'user.message');
        assert.equal(queued.processed_at, null, 'The later request was consumed while the first shell was held');

        const draining = await advanceInstallationDrain(stack);
        const active = draining.pending.find((allocation) => allocation.sessionId === context.session.id);

        assert.equal(active?.phase, 'working', 'The supervisor tried to stop an active shell');

        const before = await readInstalledComputer(context, SandboxReport, { path: '/workspace' });
        const machineId = Option.getOrThrow(before.sandboxId);

        const pending = await readInstalledComputer(context, SandboxReport, { path: '/workspace' });

        assert.deepEqual(pending.environment.committedGeneration, before.environment.committedGeneration);
        assert.ok(Option.isNone(pending.environment.stop), 'A live tool was drained before it completed');
        assert.equal(await sandbox.readFile({ machineId, path: posix.join('/workspace', filename) }), undefined);
        gate.release();

        const completed = await waitFor({
          name: 'the earlier and queued commands to return linked shell results',
          read: () => context.client.beta.sessions.events.list(context.session.id, { limit: EVENT_PAGE_ROWS }),
          accept: (history) =>
            history.data.filter((event) => event.type === 'user.tool_result').length >= commands.length,
        });

        const called = completed.data.filter((event) => event.type === 'agent.tool_use');
        const returned = completed.data.filter((event) => event.type === 'user.tool_result');

        assert.deepEqual(
          called.map((event) => event.input['command']),
          commands,
        );
        assert.deepEqual(
          returned.map((event) => event.tool_use_id),
          called.map((event) => event.id),
        );
        assert.ok(returned.every((event) => event.is_error !== true));

        await waitFor({
          name: 'the supervisor to confirm physical release',
          timeoutMs: RELEASE_TIMEOUT_MS,
          read: () => advanceInstallationDrain(stack),
          accept: (report) => report.pending.length === 0 && !report.hasMore,
        });

        const { receipt, isPhysicallyAbsent } = await waitForInstalledRelease(context, { machineId });

        assert.equal(receipt.phase, SandboxStopPhase.Completed, Option.getOrUndefined(receipt.lastError));
        assert.ok(isPhysicallyAbsent);

        const contents = await runInstalledBash(context, { command: `cat '${filename}'` });

        assert.equal(contents.trimEnd(), 'first\nlater');
        assert.equal(gate.readRequests().length, 1);
      } finally {
        gate.release();

        await gate.close();
      }
    },
  });
}

async function advanceInstallationDrain(stack: ScenarioInput['stack']) {
  const sandbox = stack.sandbox;

  assert.ok(sandbox !== undefined);

  const response = await fetch(new URL(SANDBOX_INSTALLED_DRAIN_PATH, stack.origin), {
    method: HttpMethod.Post,
    headers: { [HttpHeader.Authorization]: `Bearer ${sandbox.bearer}` },
    redirect: 'error',
  });

  assert.ok(response.ok, `The local supervisor drain returned HTTP ${response.status}`);

  return Schema.decodeUnknownSync(InstalledDrainReport)(await response.json());
}
