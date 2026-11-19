import { createManagedContext, requireFixtures } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const systemRoles: ReadonlySet<string> = new Set(['system', 'developer']);
const ProviderMessages = Schema.Array(Schema.Struct({ role: Schema.NonEmptyString, content: Schema.Json }));

export async function attachedMemoryGuidesProvider({ stack }: ScenarioInput): Promise<void> {
  const { model } = requireFixtures(stack);
  const name = randomUUID();

  const { client, agent, session, environment } = await createManagedContext({
    stack,
    name,
    agent: { tools: [{ type: 'agent_toolset_20260401' }] },
  });

  const store = await client.beta.memoryStores.create({
    name: `Notes ${name}`,
    description: 'Approved engineering notes',
  });

  const guidance = `Use these notes for ${name}.`;

  const attached = await client.beta.sessions.create({
    agent: agent.id,
    environment_id: environment.id,
    resources: [{ type: 'memory_store', memory_store_id: store.id, access: 'read_only', instructions: guidance }],
  });

  async function providerSystemText(id: string) {
    const marker = randomUUID();

    model.configure({ marker, replies: [{ text: 'OK' }] });
    await client.beta.sessions.events.send(id, {
      events: [{ type: 'user.message', content: [{ type: 'text', text: marker }] }],
    });

    const call = await model.waitForCall({ marker, index: 0 });
    const messages = Schema.decodeUnknownSync(ProviderMessages)(call.body['messages']);

    return messages
      .filter((entry) => systemRoles.has(entry.role))
      .map((entry) => JSON.stringify(entry.content))
      .join('\n');
  }

  try {
    const note = await providerSystemText(attached.id);
    const [mount] = attached.resources;

    assert.ok(mount?.type === 'memory_store' && typeof mount.mount_path === 'string');

    for (const field of [store.name, store.description, mount.mount_path, 'read_only', guidance]) {
      assert.ok(note.includes(field));
    }

    const other = await providerSystemText(session.id);

    assert.equal(other.includes(guidance), false);
    assert.equal(other.includes(store.name), false);
  } finally {
    await client.beta.memoryStores.delete(store.id);
  }
}
