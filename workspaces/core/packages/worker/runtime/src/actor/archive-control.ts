import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Session, Tx } from '@earendil-works/pi-durable';
import { StoreConflict } from '@mechane/control-store';
import { RequestInvalid } from '@mechane/protocol';
import type { ActorControlChange, MechScope } from './client.ts';
import { ControlChanges } from './collections.ts';
import { fingerprint, State } from './state.ts';

export async function archiveState(transaction: Tx, scope: MechScope) {
  const state = await transaction.doc(State);

  if (state.scope === null) {
    state.scope = scope;
  } else if (state.scope.workspaceId !== scope.workspaceId || state.scope.mechId !== scope.mechId) {
    throw new RequestInvalid({ reason: 'The archive belongs to another mech' });
  }

  return state;
}

export async function acknowledgeArchiveControlChange(session: Session, scope: MechScope, change: ActorControlChange) {
  const digest = change.payloadDigest ?? (await fingerprint(change));

  await session.commit(async (transaction) => {
    const state = await archiveState(transaction, scope);
    const existing = await ControlChanges.read(transaction, change.id);

    if (existing !== undefined) {
      if (existing.digest !== digest) {
        throw new StoreConflict('The control change identity has different content');
      }

      return;
    }

    await ControlChanges.put(transaction, change.id, { id: change.id, digest });

    state.controlSequence = Math.max(state.controlSequence, change.sourceSequence);
  }, BACKGROUND_CONTEXT);
}
