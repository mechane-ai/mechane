import { Event, EventType } from '@mechane/protocol';
import { RecordId } from '@mechane/records';
import { createMechContext, readConsoleMessages, readEvents } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { DateTime, Option, Schema } from 'effect';
import assert from 'node:assert/strict';

export async function importedConversationRemainsReadable({ stack }: ScenarioInput): Promise<void> {
  const owner = await createMechContext({ stack, name: 'Retained Console history' });

  const fixture = await stack.prepareConversationImport({
    workspaceId: owner.account.workspaceId,
    mechId: owner.mechId,
  });

  await fixture.applyMigration();

  const conversation = await readConsoleMessages(owner);

  assert.equal(conversation.messages.length, fixture.publications.length);
  assert.equal(conversation.hasMore, false);
  assert.deepEqual(
    conversation.messages.map((message) => ({
      text: message.text,
      presentation: Option.getOrNull(message.presentation),
      createdAt: DateTime.formatIso(message.createdAt),
      role: message.role,
      runId: Option.getOrThrow(message.runId),
    })),
    fixture.publications.map((publication) => ({
      text: publication.text,
      presentation: publication.presentation,
      createdAt: publication.createdAt,
      role: 'assistant',
      runId: fixture.runId,
    })),
    'Migration changed the retained conversation content, order, timestamps, or activation association',
  );

  for (const [index, publication] of fixture.publications.entries()) {
    const message = conversation.messages[index];

    assert.ok(message !== undefined);
    assert.ok(Schema.is(RecordId)(message.id));

    if (publication.shouldRepairId) {
      assert.notEqual(message.id, publication.id, 'The invalid imported identity was not repaired');
    } else {
      assert.equal(message.id, publication.id, 'A valid imported or native publication identity changed');
    }
  }

  const events = await readEvents(owner);

  const publicationIds = events.events.flatMap((event) => {
    if (Schema.is(Event)(event) && event.type === EventType.ConsoleMessage) {
      return [event.messageId];
    }

    return [];
  });

  assert.deepEqual(
    publicationIds.toSorted((left, right) => left.localeCompare(right)),
    conversation.messages.map((message) => message.id).toSorted((left, right) => left.localeCompare(right)),
    'Activity links no longer identify the same published messages',
  );

  await fixture.applyMigration();

  assert.deepEqual(await readConsoleMessages(owner), conversation, 'Repeating migration changed the conversation');
  assert.deepEqual(await readEvents(owner), events, 'Repeating migration changed retained activity links');
}
