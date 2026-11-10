import { RemoteToolPolicy } from '@mechane/protocol';
import {
  configureMcpConnection,
  createAccount,
  createMech,
  discoverMcpTools,
  findOfferedMcpTool,
  grantMcpTools,
  requireFixtures,
  sendNotification,
  startMcpFixture,
  waitForTurn,
  withMcpConnection,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function remoteToolGrantsHonorPolicy({ stack }: Pick<ScenarioInput, 'stack'>): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `remote-policy-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const owner = { stack, account, mechId: mech.id };
  const { model } = requireFixtures(stack);
  const fixture = await startMcpFixture();

  await withMcpConnection({
    ...owner,
    fixture,
    policy: RemoteToolPolicy.ReadOnlyFree,
    use: async (connection) => {
      await grantMcpTools({ ...owner, fixture, connectionId: connection.id });

      const readOnlyTools = await discoverMcpTools({ ...owner, model, marker });

      assert.ok(findOfferedMcpTool({ tools: readOnlyTools, description: fixture.descriptions.read }) !== undefined);
      assert.equal(findOfferedMcpTool({ tools: readOnlyTools, description: fixture.descriptions.write }), undefined);

      await configureMcpConnection({
        ...owner,
        fixture,
        connectionId: connection.id,
        policy: RemoteToolPolicy.IdempotentFree,
      });

      const writableTools = await discoverMcpTools({ ...owner, model, marker: `writable-${randomUUID()}` });
      const readName = findOfferedMcpTool({ tools: writableTools, description: fixture.descriptions.read });
      const writeName = findOfferedMcpTool({ tools: writableTools, description: fixture.descriptions.write });

      assert.ok(readName !== undefined);
      assert.ok(writeName !== undefined);
      assert.equal(findOfferedMcpTool({ tools: writableTools, description: fixture.descriptions.unsafe }), undefined);

      const writeMarker = `write-${randomUUID()}`;

      model.configure({
        marker: writeMarker,
        replies: [
          {
            tools: [
              { id: randomUUID(), name: readName, input: {} },
              { id: randomUUID(), name: writeName, input: { requestID: randomUUID() } },
            ],
          },
          { text: 'The granted operations finished.' },
        ],
      });

      const write = await sendNotification({ ...owner, text: writeMarker });

      await waitForTurn({ ...owner, notificationId: write.id });

      const committed = fixture.readCalls();

      assert.deepEqual(new Set(committed), new Set([fixture.names.Read, fixture.names.Write]));

      const revokedMarker = `downgrade-${randomUUID()}`;

      model.configure({
        marker: revokedMarker,
        replies: [
          { isHeld: true, tools: [{ id: randomUUID(), name: writeName, input: { requestID: randomUUID() } }] },
          { text: 'The changed policy was respected.' },
        ],
      });

      const revoked = await sendNotification({ ...owner, text: revokedMarker });

      await model.waitForCall({ marker: revokedMarker, index: 0 });

      try {
        await configureMcpConnection({
          ...owner,
          fixture,
          connectionId: connection.id,
          policy: RemoteToolPolicy.ReadOnlyFree,
        });
      } finally {
        model.release({ marker: revokedMarker, index: 0 });
      }

      await waitForTurn({ ...owner, notificationId: revoked.id });

      assert.deepEqual(fixture.readCalls(), committed, 'A policy downgrade allowed a later MCP write');
    },
  });
}
