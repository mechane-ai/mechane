import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { ROOT_CONVERSATION_ID } from '@earendil-works/pi-durable';
import type { Session, Tx } from '@earendil-works/pi-durable';
import { StoreConflict } from '@mechane/control-store';
import { MechHistorySourceKind, RequestInvalid } from '@mechane/protocol';
import type { MechHistoryImportBatch, MechHistoryImportReceipt } from '@mechane/protocol';
import { Record, Schema } from 'effect';
import { appendImportedHistory } from '../views/imported.ts';
import { archiveState } from './archive-control.ts';
import type { MechScope } from './client.ts';
import {
  Attempts,
  Cancellations,
  Effects,
  Events,
  Exports,
  ImportedCompletions,
  ImportedHistory,
  ImportedNotifications,
  ImportedRunPointers,
  Imports,
  Messages,
  Notifications,
  Observations,
  PendingNotifications,
  putEffect,
  Routines,
  Turns,
  UnresolvedImportedEffects,
  Wakes,
} from './collections.ts';
import { StoredFields } from './records.ts';
import { fingerprint, stableJson } from './state.ts';
import type { ActorState } from './state.ts';

const CONVERSATION_PROBE_ROWS = 2;

async function requireEmptyTarget(transaction: Tx, state: ActorState): Promise<void> {
  const holdsEnvironment = state.exportHold !== null || state.checkpointBarrier !== null;
  const needsRecovery = state.isResumePending || state.isEnvironmentCheckpointRequired;

  if (holdsEnvironment || needsRecovery) {
    throw new RequestInvalid({ reason: 'The target archive has unfinished recovery or an outstanding export' });
  }

  const tasks = await transaction.scanTasks({}, 1);
  const conversations = await transaction.scanConversations({}, CONVERSATION_PROBE_ROWS);

  if (conversations.items.some((conversation) => conversation.id !== ROOT_CONVERSATION_ID)) {
    throw new RequestInvalid({ reason: 'History import requires an empty archive' });
  }

  const root = conversations.items[0];
  const hasEntries = root !== undefined && (await transaction.latestEntryId(root.id)) !== undefined;

  if (tasks.items.length > 0 || hasEntries) {
    throw new RequestInvalid({ reason: 'History import requires an empty archive' });
  }

  for (const collection of [
    Notifications,
    PendingNotifications,
    Turns,
    Events,
    Messages,
    Effects,
    Attempts,
    Cancellations,
    Wakes,
    Routines,
    Imports,
    Exports,
    Observations,
    ImportedHistory,
    ImportedNotifications,
    ImportedCompletions,
  ]) {
    if ((await collection.countInTransaction(transaction)) > 0) {
      throw new RequestInvalid({ reason: 'History import requires an empty archive' });
    }
  }
}

function retainedPayload(payload: Readonly<Record<string, unknown>> | null): string | null {
  if (payload === null) {
    return null;
  }

  return JSON.stringify(payload);
}

function hasSourceContext(
  context: NonNullable<MechHistoryImportBatch['context']>,
  history: MechHistoryImportBatch['history'],
): boolean {
  return history.some((entry) => {
    const record = entry['record'];

    if (entry['kind'] !== MechHistorySourceKind.Context || !Schema.is(StoredFields)(record)) {
      return false;
    }

    return Record.toEntries(context).every(
      ([key, value]) => key in record && stableJson(record[key]) === stableJson(value),
    );
  });
}

async function retainEffect(transaction: Tx, effect: MechHistoryImportBatch['executions'][number]): Promise<void> {
  const saved = {
    ...effect,
    runtimeSource: 'imported' as const,
    request: retainedPayload(effect.request),
    result: retainedPayload(effect.result),
  };

  const previous = await Effects.read(transaction, effect.id);

  if (previous !== undefined) {
    if (stableJson(previous) !== stableJson(saved)) {
      throw new StoreConflict('The preserved execution receipt changed');
    }

    return;
  }

  await putEffect(transaction, saved);

  if ((await ImportedRunPointers.read(transaction, effect.runId)) === undefined) {
    await UnresolvedImportedEffects.put(transaction, effect.id, effect.id);
  }
}

async function finishImport(transaction: Tx, scope: MechScope, receipt: MechHistoryImportReceipt): Promise<void> {
  for (const id of await UnresolvedImportedEffects.allInTransaction(transaction)) {
    const effect = await Effects.read(transaction, id);

    if (effect === undefined || (await ImportedRunPointers.read(transaction, effect.runId)) === undefined) {
      throw new RequestInvalid({ reason: 'An imported execution has no preserved owning turn' });
    }

    await UnresolvedImportedEffects.remove(transaction, id);
  }

  const state = await archiveState(transaction, scope);
  const id = crypto.randomUUID();
  const sequence = state.eventBaseSequence + (await Events.totalInTransaction(transaction)) + 1;

  await Events.put(transaction, id, {
    ...scope,
    id,
    sequence,
    type: 'history.imported',
    runId: null,
    createdAt: new Date().toISOString(),
    payload: receipt,
  });
}

export async function importArchiveHistory(session: Session, scope: MechScope, input: MechHistoryImportBatch) {
  const digest = await fingerprint(input);
  const receipt = { sourceDigest: input.sourceDigest, sourceSequence: input.sourceSequence, isFinal: input.isFinal };

  await session.commit(async (transaction) => {
    const state = await archiveState(transaction, scope);
    const previous = await Imports.read(transaction, input.requestId);

    if (previous !== undefined) {
      if (previous.digest !== digest) {
        throw new StoreConflict('The imported batch identity has changed');
      }

      return;
    }

    if (state.importSequence !== input.expectedSequence || input.sourceSequence !== input.expectedSequence + 1) {
      throw new StoreConflict('The imported batch cursor is not contiguous');
    }

    if (state.importSequence === 0) {
      await requireEmptyTarget(transaction, state);
    } else if (state.isImportComplete || state.importDigest !== input.sourceDigest) {
      throw new StoreConflict('The archive manifest is complete or differs from the imported source');
    }

    if (input.expectedSequence !== 0 && (input.context !== null || input.workingContext !== null)) {
      throw new RequestInvalid({ reason: 'Only the first archive batch can supply working context' });
    }

    if (input.context !== null) {
      state.notificationBaseSequence = input.context.receivedSequence;
      state.observedSequence = input.context.presentedSequence;
      state.isEnvironmentCheckpointRequired = input.context.isEnvironmentCheckpointRequired;

      if (!hasSourceContext(input.context, input.history)) {
        await appendImportedHistory(transaction, scope, { kind: MechHistorySourceKind.Context, record: input.context });
      }
    }

    if (input.workingContext !== null) {
      await appendImportedHistory(transaction, scope, {
        kind: MechHistorySourceKind.Context,
        record: { context: input.workingContext, sourceDigest: input.sourceDigest },
      });
    }

    for (const notification of input.notifications) {
      if (notification.workspaceId !== scope.workspaceId || notification.mechId !== scope.mechId) {
        throw new RequestInvalid({ reason: 'The imported notification belongs to another mech' });
      }

      const existing = await ImportedNotifications.read(transaction, notification.id);

      if (existing !== undefined && stableJson(existing) !== stableJson(notification)) {
        throw new StoreConflict('The preserved notification payload changed');
      }

      await ImportedNotifications.put(transaction, notification.id, notification);

      state.notificationBaseSequence = Math.max(state.notificationBaseSequence, notification.receivedSequence);

      if (notification.receivedSequence > state.observedSequence) {
        await PendingNotifications.put(transaction, notification.id, JSON.stringify(notification));
      }
    }

    for (const entry of input.history) {
      const sequences = await appendImportedHistory(transaction, scope, entry);
      state.eventBaseSequence = Math.max(state.eventBaseSequence, sequences.eventSequence);
      state.messageBaseSequence = Math.max(state.messageBaseSequence, sequences.messageSequence);
    }

    for (const effect of input.executions) {
      await retainEffect(transaction, effect);
    }

    if (input.isFinal) {
      await finishImport(transaction, scope, receipt);
    }

    await Imports.put(transaction, input.requestId, { id: input.requestId, digest });

    state.importSequence = input.sourceSequence;
    state.importDigest = input.sourceDigest;
    state.isImportComplete = input.isFinal;
    state.isQuiesced = true;
  }, BACKGROUND_CONTEXT);

  return receipt;
}
