import type { DeliverInput } from '@mechane/harness';
import type { MechTables, PendingItemRow } from '@mechane/mech-store';
import { Delivery, MechStatus } from '@mechane/protocol';
import { Option } from 'effect';
import { mechAgent } from '../mech-agent.ts';

type NextDeliveriesInput = { readonly store: MechTables; readonly pending: ReadonlyArray<PendingItemRow> };
type DeliveryItemsInput = { readonly pending: ReadonlyArray<PendingItemRow>; readonly isRunning: boolean };

const RUNNING_DELIVERIES: ReadonlySet<Delivery> = new Set([Delivery.NextPause, Delivery.Silent]);

/**
 * Releases eligible input only for an active mech after its owed notes have been delivered. A saved definition becomes
 * active only when no turn or drone runs; later inputs remain in the host inbox until the next turn boundary.
 */
export function nextDeliveries({ store, pending }: NextDeliveriesInput): ReadonlyArray<DeliverInput> {
  const current = store.mech();

  if (Option.isNone(current) || current.value.status !== MechStatus.Active || store.owedNotes().length > 0) {
    return [];
  }

  const running = store.runningTurn();
  const isRunning = Option.isSome(running);

  if (!isRunning && store.runningDrones().length === 0) {
    store.activateDefinition({ revision: current.value.revision });
  }

  const definition = store.activeDefinition();
  const agent = mechAgent({ mech: definition });
  const items = deliveryItems({ pending, isRunning });

  return items.map((inboxItem) => ({ inboxItem, agent }));
}

function deliveryItems({ pending, isRunning }: DeliveryItemsInput): ReadonlyArray<PendingItemRow> {
  if (isRunning) {
    return pending.filter(({ delivery }) => RUNNING_DELIVERIES.has(delivery));
  }

  // Follow-ups stay in the host inbox so a lifecycle or definition change can take effect between turns.
  const firstInput = pending.findIndex(({ delivery }) => delivery !== Delivery.Silent);

  if (firstInput === -1) {
    return pending;
  }

  return pending.slice(0, firstInput + 1);
}
