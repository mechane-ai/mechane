import { WorkspaceList, WorkspacePolicy } from '@mechane/protocol';
import {
  closeInstalledContext,
  createAccount,
  createInstalledContext,
  readSandboxMachines,
  requireFixtures,
  runCli,
  runInstalledBash,
  setMachineLimit,
  startCommandGate,
  waitFor,
} from '@mechane/testing';
import type { ManagedContext, ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { posix } from 'node:path';

const DISPATCH_TIMEOUT_MS = 150_000;
const BOTH_SHELLS_TIMEOUT_MS = 300_000;

export async function installedCapacityProtectsPhysicalMachines({ stack }: ScenarioInput): Promise<void> {
  const owner = await createAccount({ stack, login: requireFixtures(stack).github.users.owner.login });
  const listed = await runCli({ stack, account: owner, args: ['workspace', 'list'], schema: WorkspaceList });
  const workspace = listed.workspaces.find((candidate) => candidate.name === 'Softmax');

  assert.ok(workspace !== undefined, 'The fixture installation workspace is missing');

  const administrator = { ...owner, workspaceId: workspace.id };

  const before = await runCli({
    stack,
    account: administrator,
    args: ['workspace', 'policy', 'show', workspace.id],
    schema: WorkspacePolicy,
  });

  const baseline = new Set(await readSandboxMachines(stack));

  async function currentMachines() {
    const machines = await readSandboxMachines(stack);

    return machines.filter((id) => !baseline.has(id));
  }

  const contexts = new Set<ManagedContext>();
  const failures: Array<unknown> = [];
  const gates = await Promise.all([startCommandGate({ stack }), startCommandGate({ stack })]);
  const file = posix.join('/workspace', `.capacity-${randomUUID()}`);

  try {
    await setMachineLimit({ stack, account: administrator, machines: 0 });

    for (const name of ['capacity-left', 'capacity-right']) {
      contexts.add(await createInstalledContext({ stack, name }));
    }

    const candidates = Array.from(contexts, (context, index) => {
      const gate = gates[index];

      assert.ok(gate !== undefined);

      const marker = context.session.id;
      const command = `test ! -e '${file}' && printf '%s' '${marker}' > '${file}' && curl -fsS '${gate.url}' && cat '${file}'`;
      const result = Promise.allSettled([runInstalledBash(context, { command, timeoutMs: BOTH_SHELLS_TIMEOUT_MS })]);

      return { context, gate, result };
    });

    for (const { context } of candidates) {
      await waitFor({
        name: 'the requested shell to reach the installed worker queue',
        read: () => context.client.beta.sessions.events.list(context.session.id, { types: ['agent.tool_use'] }),
        accept: (history) => history.data.some((event) => event.type === 'agent.tool_use' && event.name === 'bash'),
      });
    }

    const left = candidates[0];

    assert.ok(left !== undefined);

    const paused = await left.context.client.beta.environments.work.stats(left.context.environment.id);

    assert.ok(paused.depth >= candidates.length, 'The installation lost a waiting session at zero capacity');
    assert.deepEqual(await currentMachines(), [], 'Zero capacity started a physical machine');
    assert.ok(gates.every((gate) => gate.readRequests().length === 0));

    await setMachineLimit({ stack, account: administrator, machines: 1 });

    const first = await waitFor({
      name: 'one waiting shell to enter the single physical slot',
      timeoutMs: DISPATCH_TIMEOUT_MS,
      read: async () => candidates.find(({ gate }) => gate.readRequests().length > 0),
      accept: (candidate) => candidate !== undefined,
    });

    assert.ok(first !== undefined);

    const second = candidates.find((candidate) => candidate !== first);

    assert.ok(second !== undefined);

    const initialMachines = await currentMachines();

    assert.equal(initialMachines.length, 1, 'The contenders started more than one physical machine');
    assert.equal(second.gate.readRequests().length, 0);

    const occupied = await second.context.client.beta.environments.work.stats(second.context.environment.id);

    assert.ok(occupied.depth >= 1, 'The installation dropped the second session while the slot was occupied');
    first.gate.release();

    const [firstResult] = await first.result;

    if (firstResult.status === 'rejected') {
      throw firstResult.reason;
    }

    assert.equal(firstResult.value.trim(), first.context.session.id);
    await closeInstalledContext(first.context);
    contexts.delete(first.context);

    await waitFor({
      name: 'the second shell to acquire the released slot',
      timeoutMs: DISPATCH_TIMEOUT_MS,
      read: async () => {
        const machines = await currentMachines();

        assert.ok(machines.length <= 1, 'The successor started before the first physical machine was removed');

        return second.gate.readRequests().length;
      },
      accept: (count) => count > 0,
    });

    const afterRelease = await currentMachines();

    assert.equal(afterRelease.length, 1, 'The old guest still occupies the slot after its successor started');
    assert.notDeepEqual(afterRelease, initialMachines, 'Distinct sessions shared a physical computer');
    second.gate.release();

    const [secondResult] = await second.result;

    if (secondResult.status === 'rejected') {
      throw secondResult.reason;
    }

    assert.equal(
      secondResult.value.trim(),
      second.context.session.id,
      'The successor could not claim its own workspace file',
    );
    assert.deepEqual(
      gates.map((gate) => gate.readRequests().length),
      [1, 1],
    );
  } catch (cause) {
    failures.push(cause);
    await stack.captureFailure('installed-capacity').catch(() => undefined);
  } finally {
    for (const gate of gates) {
      gate.release();
    }

    const closed = await Promise.allSettled(Array.from(contexts, closeInstalledContext));

    const restored = await Promise.allSettled([
      ...gates.map((gate) => gate.close()),
      setMachineLimit({ stack, account: administrator, machines: before.machines }),
    ]);

    for (const outcome of [...closed, ...restored]) {
      if (outcome.status === 'rejected') {
        failures.push(outcome.reason);
      }
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, 'The installed machine capacity scenario failed');
  }
}
