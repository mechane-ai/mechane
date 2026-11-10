import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { LiveDoc } from '@earendil-works/pi-durable';
import { RequestConflict, RequestInvalid } from '@mechane/protocol';
import type { ActorExport } from './client.ts';
import { Exports } from './collections.ts';
import { decodeStored, ExportRecord } from './records.ts';
import { State } from './state.ts';
import type { ActorAccess } from './types.ts';

export async function acquireExportHold(access: ActorAccess, requestId: string): Promise<ActorExport | null> {
  return await access.harness.commit(async (transaction) => {
    const state = await transaction.doc(State);
    const existing = await Exports.read(transaction, requestId);

    if (existing !== undefined) {
      return decodeStored(ExportRecord, existing.value);
    }

    if (state.exportHold !== null) {
      throw new RequestConflict({ reason: 'Another context export is in progress' });
    }

    if (state.isResumePending) {
      throw new RequestInvalid({ reason: 'The environment resume barrier must settle before exporting context' });
    }

    if (!state.isImportComplete) {
      throw new RequestInvalid({ reason: 'The history import must complete before exporting context' });
    }

    const live = await transaction.doc(LiveDoc, access.conversation.id);

    if (live.run !== undefined) {
      throw new RequestInvalid({ reason: 'The mech must be idle before exporting context' });
    }

    state.exportHold = { id: requestId, shouldRelease: !state.isQuiesced };
    state.isQuiesced = true;

    return null;
  }, BACKGROUND_CONTEXT);
}

export async function releaseExportHold(access: ActorAccess, requestId: string | null): Promise<void> {
  await access.harness.commit(async (transaction) => {
    const state = await transaction.doc(State);
    const hold = state.exportHold;

    if (hold !== null && (requestId === null || hold.id === requestId)) {
      if (hold.shouldRelease) {
        state.isQuiesced = false;
      }

      state.exportHold = null;
    }
  }, BACKGROUND_CONTEXT);
}

export async function quiesceActor(access: ActorAccess): Promise<void> {
  await access.harness.commit(async (transaction) => {
    const state = await transaction.doc(State);
    const live = await transaction.doc(LiveDoc, access.conversation.id);

    if (live.run !== undefined) {
      throw new RequestInvalid({ reason: 'The mech must be idle before a quiesced export or import' });
    }

    state.isQuiesced = true;
    state.isResumePending = false;

    if (state.exportHold !== null) {
      state.exportHold.shouldRelease = false;
    }
  }, BACKGROUND_CONTEXT);
}
