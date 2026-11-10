import { TurnStatus, UnansweredReason } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import {
  createAccount,
  createMech,
  readConsoleMessages,
  readNativeChunks,
  readNativeTrace,
  requireFixtures,
  sendNotificationAndWait,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const REPLAY_START_FRACTION = 0.5;
const GENERATION_ID = 'gen-1794259874-AbCdEfGhIjKlMnOpQrStUvWx';

export async function nativeStreamFailureIsReplayable({ stack }: ScenarioInput): Promise<void> {
  const fixtures = requireFixtures(stack);
  const account = await createAccount({ stack });
  const mech = await createMech({ stack, account, name: `failed-stream-${randomUUID()}` });
  const owner = { stack, account, mechId: mech.id };
  const promptCanary = `private-prompt-${randomUUID()}`;
  const metadataCanary = `provider-metadata-${randomUUID()}`;
  const canaries = [fixtures.model.apiKey, promptCanary, metadataCanary];

  const streamError = {
    code: HttpStatusCode.TooManyRequests,
    type: 'rate_limit_error',
    param: 'model',
    message: `${fixtures.model.apiKey} ${promptCanary}`,
    metadata: { raw: `${fixtures.model.apiKey} ${promptCanary}`, unexpected_detail: metadataCanary },
  };

  const replies = [
    { status: HttpStatusCode.BadRequest },
    { streamError, streamResponseId: GENERATION_ID },
    { streamError },
  ];

  for (const reply of replies) {
    const marker = `failed-stream-${randomUUID()}`;

    fixtures.model.configure({ marker, replies: [reply] });

    const failed = await sendNotificationAndWait({ ...owner, text: `${marker}\n${promptCanary}` });

    if (failed.status !== TurnStatus.Failed) {
      throw new Error('The failed model request has no terminal activation');
    }

    assert.equal(failed.reason, UnansweredReason.Faulted);

    const address = {
      origin: stack.origin,
      workspaceId: account.workspaceId,
      mechId: mech.id,
      turnId: failed.id,
      token: account.token,
    };

    const chunks = await readNativeChunks(await readNativeTrace(address));
    const failure = chunks.find((chunk) => chunk.type === 'error');

    assert.ok(failure !== undefined);

    if (reply.streamError !== undefined) {
      const encoded = /\{[^{}]*\}/u.exec(failure.errorText);

      assert.ok(encoded !== null, 'The provider stream failure lost its structured diagnostic');

      const diagnostic = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))(encoded[0]);

      const expected = {
        category: 'rate_limit',
        type: 'rate_limit_error',
        status: HttpStatusCode.TooManyRequests,
        param: 'model',
      };

      if (reply.streamResponseId === undefined) {
        assert.deepEqual(diagnostic, expected, "The failure inherited another request's generation ID");
      } else {
        assert.deepEqual(diagnostic, { ...expected, generationId: GENERATION_ID });
      }

      const serialized = JSON.stringify(chunks);
      const disclosedCanary = canaries.some((canary) => serialized.includes(canary));

      assert.equal(disclosedCanary, false, 'The native failure stream disclosed provider credentials or data');
    }

    const replay = await readNativeChunks(await readNativeTrace(address));

    assert.deepEqual(replay, chunks);

    const startIndex = Math.floor(chunks.length * REPLAY_START_FRACTION);
    const resumed = await readNativeChunks(await readNativeTrace({ ...address, startIndex }));

    assert.deepEqual(resumed, chunks.slice(startIndex));
    assert.equal(fixtures.model.readCalls({ marker }).length, 1);

    const conversation = await readConsoleMessages(owner);

    assert.equal(conversation.messages.filter((message) => message.role === 'assistant').length, 0);
  }
}
