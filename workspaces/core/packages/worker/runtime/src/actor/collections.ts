import type { Tx } from '@earendil-works/pi-durable';
import { SourceCompletion } from '@mechane/protocol';
import { Schema } from 'effect';
import {
  AttemptRow,
  CancellationRow,
  ControlChangeRow,
  EffectRow,
  ExportRow,
  NotificationRow,
  ObservationRow,
  RoutineRow,
  TurnRow,
  WakeRow,
} from './record-schemas.ts';
import type { EffectRecord } from './record-schemas.ts';
import { actorRecordCollection, actorRecordSet } from './record-store.ts';
import { ActivityRecord, MessageRecord, NativeFields, NotificationRecord } from './records.ts';

const pendingEffectStates: ReadonlySet<EffectRecord['status']> = new Set(['pending', 'running', 'uncertain']);

export const Notifications = actorRecordCollection('notifications', NotificationRow);
export const PendingNotifications = actorRecordCollection('pending-notifications', Schema.String);
export const Turns = actorRecordCollection('turns', TurnRow);
export const TaskTurns = actorRecordCollection('task-turns', Schema.String);
export const OpenTurns = actorRecordSet('open-turns');
export const Observations = actorRecordCollection('observations', ObservationRow);
export const Effects = actorRecordCollection('effects', EffectRow);
export const PendingEffects = actorRecordSet('pending-effects');
export const Attempts = actorRecordCollection('attempts', AttemptRow);
export const Cancellations = actorRecordCollection('cancellations', CancellationRow);
export const PendingCancellations = actorRecordSet('pending-cancellations');
export const Events = actorRecordCollection('events', ActivityRecord);
export const Messages = actorRecordCollection('messages', MessageRecord);
export const Wakes = actorRecordCollection('wakes', WakeRow);
export const Routines = actorRecordCollection('routines', RoutineRow);

export const ControlChanges = actorRecordCollection('control-changes', ControlChangeRow);
export const Imports = actorRecordCollection('imports', ControlChangeRow);
export const Exports = actorRecordCollection('exports', ExportRow);
export const ImportedHistory = actorRecordCollection('imported-history', NativeFields);
export const ImportedNotifications = actorRecordCollection('imported-notifications', NotificationRecord);
export const ImportedCompletions = actorRecordCollection('imported-completions', SourceCompletion);
export const UnresolvedImportedEffects = actorRecordSet('unresolved-imported-effects');
export const ImportedRunPointers = actorRecordCollection('imported-run-pointers', Schema.String);
export const ImportedEventPointers = actorRecordCollection('imported-event-pointers', Schema.String);
export const ImportedMessagePointers = actorRecordCollection('imported-message-pointers', Schema.String);

export function runEvents(turnId: string) {
  return actorRecordCollection(`run-events:${turnId}`, Schema.String);
}

function runEffects(turnId: string) {
  return actorRecordCollection(`run-effects:${turnId}`, Schema.String);
}

export function runAttempts(turnId: string) {
  return actorRecordCollection(`run-attempts:${turnId}`, Schema.String);
}

export async function putEffect(transaction: Tx, row: EffectRecord): Promise<void> {
  await Effects.put(transaction, row.id, row);
  await runEffects(row.runId).put(transaction, row.id, row.id);

  if (pendingEffectStates.has(row.status)) {
    await PendingEffects.put(transaction, row.id, row.id);
  } else {
    await PendingEffects.remove(transaction, row.id);
  }
}
