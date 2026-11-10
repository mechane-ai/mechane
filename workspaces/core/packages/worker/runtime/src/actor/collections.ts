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
  TurnRow,
  WakeRow,
} from './record-schemas.ts';
import type { AttemptRecord, CancellationRecord, EffectRecord, TurnRecord } from './record-schemas.ts';
import { actorRecordCollection, actorRecordSet } from './record-store.ts';
import { ActivityRecord, decodeStored, MessageRecord, NativeFields, NotificationRecord, RunRecord } from './records.ts';

const pendingEffectStates: ReadonlySet<EffectRecord['status']> = new Set(['pending', 'running', 'uncertain']);

const pendingAttemptPhases: ReadonlySet<AttemptRecord['phase']> = new Set([
  'intent',
  'reserved',
  'release',
  'settlement',
]);

export const Notifications = actorRecordCollection('notifications', NotificationRow);
export const PendingNotifications = actorRecordCollection('pending-notifications', Schema.String);
export const SubmissionNotifications = actorRecordCollection('submission-notifications', Schema.String);
export const SequenceNotifications = actorRecordCollection('sequence-notifications', Schema.String);
export const Turns = actorRecordCollection('turns', TurnRow);
export const TaskTurns = actorRecordCollection('task-turns', Schema.String);
export const OpenTurns = actorRecordSet('open-turns');
export const Observations = actorRecordCollection('observations', ObservationRow);
export const Effects = actorRecordCollection('effects', EffectRow);
export const PendingEffects = actorRecordSet('pending-effects');
export const Attempts = actorRecordCollection('attempts', AttemptRow);
export const PendingAttempts = actorRecordSet('pending-attempts');
export const Cancellations = actorRecordCollection('cancellations', CancellationRow);
export const PendingCancellations = actorRecordSet('pending-cancellations');
export const Events = actorRecordCollection('events', ActivityRecord);
export const Messages = actorRecordCollection('messages', MessageRecord);
export const Wakes = actorRecordCollection('wakes', WakeRow);
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
export const ToolTransitions = actorRecordCollection('tool-transitions', Schema.String);

export function runEvents(turnId: string) {
  return actorRecordCollection(`run-events:${turnId}`, Schema.String);
}

export function runEffects(turnId: string) {
  return actorRecordCollection(`run-effects:${turnId}`, Schema.String);
}

export function runAttempts(turnId: string) {
  return actorRecordCollection(`run-attempts:${turnId}`, Schema.String);
}

export async function putTurn(transaction: Tx, row: TurnRecord): Promise<void> {
  await Turns.put(transaction, row.id, row);

  for (const taskId of row.taskIds) {
    await TaskTurns.put(transaction, String(taskId), row.id);
  }

  if (decodeStored(RunRecord, row.value).endedAt === null) {
    await OpenTurns.put(transaction, row.id, row.id);
  } else {
    await OpenTurns.remove(transaction, row.id);
  }
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

export async function putAttempt(transaction: Tx, row: AttemptRecord): Promise<void> {
  await Attempts.put(transaction, row.id, row);
  await runAttempts(row.turnId).put(transaction, row.id, row.id);

  if (pendingAttemptPhases.has(row.phase)) {
    await PendingAttempts.put(transaction, row.id, row.id);
  } else {
    await PendingAttempts.remove(transaction, row.id);
  }
}

export async function putCancellation(transaction: Tx, row: CancellationRecord): Promise<void> {
  await Cancellations.put(transaction, row.turnId, row);

  if (row.status === 'pending') {
    await PendingCancellations.put(transaction, row.turnId, row.turnId);
  } else {
    await PendingCancellations.remove(transaction, row.turnId);
  }
}
