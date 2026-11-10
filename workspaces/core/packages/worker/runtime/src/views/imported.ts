import type { Tx } from '@earendil-works/pi-durable';
import { StoreConflict } from '@mechane/control-store';
import { MechHistorySourceKind, RequestInvalid, SourceCompletion } from '@mechane/protocol';
import { Schema } from 'effect';
import type { ActorTrace, MechScope } from '../actor/client.ts';
import {
  ImportedCompletions,
  ImportedEventPointers,
  ImportedHistory,
  ImportedMessagePointers,
  ImportedNotifications,
  ImportedRunPointers,
} from '../actor/collections.ts';
import type { ActorRecordReader } from '../actor/record-store.ts';
import {
  ActivityRecord,
  CancellationRecord,
  ImportedRunRecord,
  MessageRecord,
  NativeFields,
  NotificationRecord,
  SpendRecord,
  StoredFields,
} from '../actor/records.ts';
import { stableJson } from '../actor/state.ts';
import type { ActivityEvent, ConsoleMessage, Notification, Run } from '../domain.ts';

const Archive = Schema.Struct({ kind: Schema.String, record: StoredFields });

type ImportedPointerCollection = typeof ImportedRunPointers;

type IndexImportedRecordInput = {
  readonly transaction: Tx;
  readonly collection: ImportedPointerCollection;
  readonly id: string;
  readonly ordinal: string;
  readonly entry: typeof NativeFields.Type;
};

function importedRun(value: unknown): Run {
  const fields = Schema.decodeUnknownSync(StoredFields)(value);

  return Schema.decodeUnknownSync(ImportedRunRecord)({ ...fields, runtimeSource: 'imported' });
}

function requireImportedScope(scope: MechScope, value: unknown): void {
  const record = Schema.decodeUnknownSync(StoredFields)(value);

  if (record['workspaceId'] !== scope.workspaceId || record['mechId'] !== scope.mechId) {
    throw new RequestInvalid({ reason: 'The imported historical record belongs to another mech' });
  }
}

function requireImportedScopes(records: ReadonlyArray<unknown>, scope: MechScope): void {
  for (const record of records) {
    requireImportedScope(scope, record);
  }
}

function importedTrace(entry: unknown, scope: MechScope): ActorTrace | null {
  if (!Schema.is(Archive)(entry)) {
    return null;
  }

  const archived = Schema.decodeUnknownSync(Archive)(entry);

  if (archived.kind !== MechHistorySourceKind.Run) {
    return null;
  }

  requireImportedScope(scope, archived.record['run']);

  const run = importedRun(archived.record['run']);
  const events = Schema.decodeUnknownSync(Schema.Array(ActivityRecord))(archived.record['events'] ?? []);

  requireImportedScopes(events, scope);

  const dispatches = Schema.decodeUnknownSync(Schema.Array(SpendRecord))(archived.record['dispatches'] ?? []);

  requireImportedScopes(dispatches, scope);

  return {
    run,
    events,
    dispatches,
    toolCalls: Schema.decodeUnknownSync(Schema.Array(Schema.Unknown))(archived.record['toolCalls'] ?? []),
    evidenceNotices: [
      ...Schema.decodeUnknownSync(Schema.Array(Schema.String))(archived.record['evidenceNotices'] ?? []),
      'Imported historical execution. No historical tool call was replayed.',
    ],
  };
}

export function importedTraces(history: ReadonlyArray<unknown>, scope: MechScope): ReadonlyArray<ActorTrace> {
  const traces: Array<ActorTrace> = [];

  for (const entry of history) {
    const trace = importedTrace(entry, scope);

    if (trace !== null) {
      traces.push(trace);
    }
  }

  return traces;
}

function importedCancellation(history: ReadonlyArray<unknown>, scope: MechScope, turnId: string) {
  for (const entry of history) {
    if (Schema.is(Archive)(entry) && entry.kind === MechHistorySourceKind.Run) {
      requireImportedScope(scope, entry.record['run']);

      const run = importedRun(entry.record['run']);

      if (run.id === turnId) {
        if (entry.record['cancellation'] === null || entry.record['cancellation'] === undefined) {
          return null;
        }

        return Schema.decodeUnknownSync(CancellationRecord)(entry.record['cancellation']);
      }
    }
  }

  return null;
}

function importedNotifications(history: ReadonlyArray<unknown>, scope: MechScope): ReadonlyArray<Notification> {
  const result: Array<Notification> = [];

  for (const entry of history) {
    if (Schema.is(Archive)(entry) && entry.kind === MechHistorySourceKind.Notification) {
      requireImportedScope(scope, entry.record);
      result.push(Schema.decodeUnknownSync(NotificationRecord)(entry.record));
    }
  }

  return result;
}

function importedCompletions(
  history: ReadonlyArray<unknown>,
  scope: MechScope,
): ReadonlyArray<typeof SourceCompletion.Type> {
  const result: Array<typeof SourceCompletion.Type> = [];

  for (const entry of history) {
    if (Schema.is(Archive)(entry) && entry.kind === MechHistorySourceKind.Completion) {
      requireImportedScope(scope, entry.record);
      result.push(Schema.decodeUnknownSync(SourceCompletion)(entry.record));
    }
  }

  return result;
}

function validateImportedExecutions(record: typeof StoredFields.Type): void {
  const run = importedRun(record['run']);
  const executions = Schema.decodeUnknownSync(Schema.Array(StoredFields))(record['executions'] ?? []);

  for (const execution of executions) {
    if (execution['runId'] !== run.id) {
      throw new RequestInvalid({ reason: 'The imported execution has another owning turn' });
    }
  }
}

function validateImportedHistory(history: ReadonlyArray<unknown>, scope: MechScope): void {
  importedTraces(history, scope);
  importedEvents(history, scope);
  importedMessages(history, scope);
  importedNotifications(history, scope);
  importedCompletions(history, scope);

  for (const entry of history) {
    const archived = Schema.decodeUnknownSync(Archive)(entry);

    if ('workspaceId' in archived.record || 'mechId' in archived.record) {
      requireImportedScope(scope, archived.record);
    }

    if (archived.kind === MechHistorySourceKind.Run) {
      validateImportedExecutions(archived.record);
    }

    if (archived.kind === MechHistorySourceKind.Manifest) {
      requireImportedScope(scope, archived.record['scope']);
    }
  }
}

async function indexImportedRecord({
  transaction,
  collection,
  id,
  ordinal,
  entry,
}: IndexImportedRecordInput): Promise<void> {
  const previous = await collection.read(transaction, id);

  if (previous !== undefined) {
    const saved = await ImportedHistory.read(transaction, previous);

    if (stableJson(saved) !== stableJson(entry)) {
      throw new StoreConflict('The preserved historical identity has different content');
    }

    return;
  }

  await collection.put(transaction, id, ordinal);
}

export async function appendImportedHistory(transaction: Tx, scope: MechScope, entry: unknown) {
  validateImportedHistory([entry], scope);

  const raw = Schema.decodeUnknownSync(NativeFields)(entry);
  const archived = Schema.decodeUnknownSync(Archive)(entry);
  const ordinal = await ImportedHistory.append(transaction, raw);
  const result = { eventSequence: 0, messageSequence: 0 };

  if (archived.kind === MechHistorySourceKind.Run) {
    const run = importedRun(archived.record['run']);

    await indexImportedRecord({ transaction, collection: ImportedRunPointers, id: run.id, ordinal, entry: raw });
  } else if (archived.kind === MechHistorySourceKind.Activity) {
    const event = Schema.decodeUnknownSync(ActivityRecord)(archived.record);

    await indexImportedRecord({ transaction, collection: ImportedEventPointers, id: event.id, ordinal, entry: raw });

    result.eventSequence = event.sequence;
  } else if (archived.kind === MechHistorySourceKind.Publication) {
    const message = Schema.decodeUnknownSync(MessageRecord)(archived.record);

    await indexImportedRecord({
      transaction,
      collection: ImportedMessagePointers,
      id: message.id,
      ordinal,
      entry: raw,
    });

    result.messageSequence = message.sequence;
  } else if (archived.kind === MechHistorySourceKind.Notification) {
    const notification = Schema.decodeUnknownSync(NotificationRecord)(archived.record);
    const previous = await ImportedNotifications.read(transaction, notification.id);

    if (previous !== undefined && stableJson(previous) !== stableJson(notification)) {
      throw new StoreConflict('The preserved notification identity has different content');
    }

    await ImportedNotifications.put(transaction, notification.id, notification);
  } else if (archived.kind === MechHistorySourceKind.Completion) {
    const completion = Schema.decodeUnknownSync(SourceCompletion)(archived.record);
    const previous = await ImportedCompletions.read(transaction, completion.executionId);

    if (previous !== undefined && stableJson(previous) !== stableJson(completion)) {
      throw new StoreConflict('The preserved completion identity has different content');
    }

    await ImportedCompletions.put(transaction, completion.executionId, completion);
  }

  return result;
}

export async function readImportedTrace(reader: ActorRecordReader, scope: MechScope, turnId: string) {
  const ordinal = await ImportedRunPointers.get(reader, turnId);

  if (ordinal === undefined) {
    return null;
  }

  return importedTrace(await ImportedHistory.get(reader, ordinal), scope);
}

export async function readImportedCancellation(reader: ActorRecordReader, scope: MechScope, turnId: string) {
  const ordinal = await ImportedRunPointers.get(reader, turnId);

  if (ordinal === undefined) {
    return null;
  }

  const entry = await ImportedHistory.get(reader, ordinal);

  return importedCancellation([entry], scope, turnId);
}

export async function readImportedEventAt(reader: ActorRecordReader, scope: MechScope, ordinal: number) {
  const pointer = await ImportedEventPointers.at(reader, ordinal);

  if (pointer === undefined) {
    return;
  }

  const events = importedEvents([await ImportedHistory.get(reader, pointer)], scope);

  return events[0];
}

export async function readImportedMessageAt(reader: ActorRecordReader, scope: MechScope, ordinal: number) {
  const pointer = await ImportedMessagePointers.at(reader, ordinal);

  if (pointer === undefined) {
    return;
  }

  const messages = importedMessages([await ImportedHistory.get(reader, pointer)], scope);

  return messages[0];
}

function importedEvents(history: ReadonlyArray<unknown>, scope: MechScope): ReadonlyArray<ActivityEvent> {
  const result: Array<ActivityEvent> = [];

  for (const entry of history) {
    if (Schema.is(Archive)(entry)) {
      const archived = Schema.decodeUnknownSync(Archive)(entry);

      if (archived.kind === MechHistorySourceKind.Activity) {
        requireImportedScope(scope, archived.record);
        result.push(Schema.decodeUnknownSync(ActivityRecord)(archived.record));
      }
    }
  }

  return result;
}

export function importedMessages(history: ReadonlyArray<unknown>, scope: MechScope): ReadonlyArray<ConsoleMessage> {
  const result: Array<ConsoleMessage> = [];

  for (const entry of history) {
    if (Schema.is(Archive)(entry)) {
      const archived = Schema.decodeUnknownSync(Archive)(entry);

      if (archived.kind === MechHistorySourceKind.Publication) {
        requireImportedScope(scope, archived.record);
        result.push(Schema.decodeUnknownSync(MessageRecord)(archived.record));
      }
    }
  }

  return result;
}
