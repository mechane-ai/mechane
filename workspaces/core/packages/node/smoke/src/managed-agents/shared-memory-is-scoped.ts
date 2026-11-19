import Anthropic, { APIError } from '@anthropic-ai/sdk';
import { sessionsTokenFromSecret } from '@anthropic-ai/sdk/lib/environments/worker';
import { SessionMemoryStores } from '@anthropic-ai/sdk/tools/agent-toolset/node';
import { HttpStatusCode } from '@mechane/records';
import { createAccount, issueEnvironmentKey, requireFixtures, waitFor } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ConflictResponse = Schema.Struct({
  error: Schema.Struct({
    type: Schema.NonEmptyString,
    conflicting_path: Schema.optional(Schema.NonEmptyString),
    conflicting_memory_id: Schema.optional(Schema.NonEmptyString),
  }),
});

function memoryConflict(failure: unknown) {
  assert.ok(failure instanceof APIError);
  assert.equal(failure.status, HttpStatusCode.Conflict);

  return Schema.decodeUnknownSync(ConflictResponse)(failure.error).error;
}

export async function sharedMemoryIsScoped({ stack }: ScenarioInput): Promise<void> {
  const { github } = requireFixtures(stack);
  const account = await createAccount({ stack, login: github.users.owner.login });
  const baseURL = stack.origin.origin;
  const owner = new Anthropic({ apiKey: account.token, baseURL, maxRetries: 0 });
  const name = randomUUID();
  const stores = owner.beta.memoryStores;
  const shared = await stores.create({ name: `Shared ${name}` });
  const reference = await stores.create({ name: `Reference ${name}` });
  const privateStore = await stores.create({ name: `Private ${name}` });
  const seed = await stores.memories.create(shared.id, { path: '/notes.md', content: name });
  const definition = await owner.beta.environments.create({ name, config: { type: 'self_hosted' } });

  const agent = await owner.beta.agents.create({
    name,
    model: 'claude-haiku-5-5',
    tools: [{ type: 'agent_toolset_20260401' }],
  });

  const session = await owner.beta.sessions.create({
    environment_id: definition.id,
    agent: agent.id,
    resources: [
      { type: 'memory_store', memory_store_id: shared.id, access: 'read_write' },
      { type: 'memory_store', memory_store_id: reference.id, access: 'read_only' },
    ],
  });

  const key = await issueEnvironmentKey({ origin: stack.origin, environmentId: definition.id, token: account.token });
  const environment = new Anthropic({ baseURL, authToken: key, maxRetries: 0 });

  const work = await waitFor({
    name: 'memory sync worker receives its session',
    read: () => environment.beta.environments.work.poll(definition.id, { block_ms: 500 }),
    accept: (assignment) => assignment !== null,
  });

  assert.ok(work !== null && typeof work.secret === 'string' && work.data.type === 'session');
  assert.equal(work.data.id, session.id);
  await environment.beta.environments.work.ack(work.id, { environment_id: definition.id });

  const token = sessionsTokenFromSecret(work.secret);

  assert.ok(typeof token === 'string' && token.length > 0);

  const worker = new Anthropic({ baseURL, authToken: token, maxRetries: 0 });
  const root = await mkdtemp(join(stack.stateDirectory, 'managed-memory-'));
  const sync = new SessionMemoryStores(worker, { workdir: root });

  try {
    const persisted = await worker.beta.sessions.retrieve(session.id);

    const resources = persisted.resources.map((resource) => {
      assert.ok(resource.type === 'memory_store');

      const path = resource.mount_path;

      assert.ok(typeof path === 'string' && path.startsWith('/mnt/memory/'));

      // The local worker resolves absolute guest paths in its disposable filesystem root.
      return { ...resource, mount_path: join(root, path) };
    });

    await sync.download({ ...persisted, resources });

    const mount = resources.find((resource) => resource.memory_store_id === shared.id);

    assert.ok(mount !== undefined);

    const notes = join(mount.mount_path, 'notes.md');

    assert.equal(await readFile(notes, 'utf8'), name);

    const updated = `revised ${name}`;

    await writeFile(notes, updated);
    await sync.finish();

    const saved = await stores.memories.retrieve(seed.id, { memory_store_id: shared.id });

    assert.equal(saved.content, updated);

    const change = await stores.memoryVersions.retrieve(saved.memory_version_id, { memory_store_id: shared.id });

    assert.deepEqual(change.created_by, { type: 'session_actor', session_id: session.id });
    await assert.rejects(
      stores.memories.update(seed.id, {
        memory_store_id: shared.id,
        content: name,
        precondition: { type: 'content_sha256', content_sha256: seed.content_sha256 },
      }),
      (failure: unknown) => {
        assert.equal(memoryConflict(failure).type, 'memory_precondition_failed_error');

        return true;
      },
    );
    await assert.rejects(
      stores.memories.create(shared.id, { path: '/notes.md/duplicate', content: 'overlap' }),
      (failure: unknown) => {
        const details = memoryConflict(failure);

        assert.equal(details.type, 'memory_path_conflict_error');
        assert.equal(details.conflicting_path, seed.path);
        assert.equal(details.conflicting_memory_id, seed.id);

        return true;
      },
    );
    await stores.memoryVersions.redact(seed.memory_version_id, { memory_store_id: shared.id });

    const redacted = await stores.memoryVersions.retrieve(seed.memory_version_id, { memory_store_id: shared.id });

    assert.equal(redacted.path, null);
    assert.equal(redacted.content, null);
    await assert.rejects(worker.beta.memoryStores.memories.create(reference.id, { path: '/no', content: name }), {
      status: HttpStatusCode.Forbidden,
    });
    await assert.rejects(worker.beta.memoryStores.memories.list(privateStore.id), { status: HttpStatusCode.NotFound });
    await worker.beta.environments.work.stop(work.id, { environment_id: definition.id, force: true });
    await assert.rejects(worker.beta.memoryStores.memories.list(shared.id), { status: HttpStatusCode.Unauthorized });
  } finally {
    await sync.dispose();
    await rm(root, { recursive: true, force: true });
    await owner.beta.sessions.events.send(session.id, { events: [{ type: 'user.interrupt' }] });
    await Promise.all([shared, reference, privateStore].map((store) => stores.delete(store.id)));
  }
}
