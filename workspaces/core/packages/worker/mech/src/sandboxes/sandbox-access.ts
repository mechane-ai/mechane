import type { MechTables } from '@mechane/mech-store';
import { SandboxAction } from '@mechane/protocol';
import type { SandboxRequest } from '@mechane/protocol';
import { Option } from 'effect';
import type { OpenedMech } from '../types.ts';
import { SandboxAccess } from './constants.ts';
import { droneAccess } from './drone-access.ts';

type SandboxAccessInput = { readonly mech: OpenedMech; readonly request: SandboxRequest };
type OwnerAccessInput = { readonly store: MechTables; readonly request: SandboxRequest };

/** Drone ownership is checked even for inspection; only changes require an idle owner. */
export async function sandboxAccess({ mech, request }: SandboxAccessInput): Promise<SandboxAccess> {
  return await mech.store.atomic({ run: (store) => ownerAccess({ store, request }) });
}

function ownerAccess({ store, request }: OwnerAccessInput): SandboxAccess {
  const { droneId, action } = request;
  const isInspection = action === SandboxAction.Show || action === SandboxAction.Download;

  if (Option.isSome(droneId)) {
    return droneAccess({ store, droneId: droneId.value, isInspection });
  }

  const running = store.runningTurn();
  const pending = store.pendingInboxItems();
  const isBusy = Option.isSome(running) || pending.length > 0;

  if (!isInspection && isBusy) {
    return SandboxAccess.Busy;
  }

  return SandboxAccess.Ready;
}
