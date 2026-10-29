import { MechStatus } from '@mechane/protocol';
import { DateTime, Option } from 'effect';
import { runSlackDelivery } from './run-slack-delivery.ts';
import type { RunSlackDeliveriesInput } from './types.ts';

/** Runs due outbox work through the active agent and its existing alarm. */
export async function runSlackDeliveries({ store, settings }: RunSlackDeliveriesInput): Promise<void> {
  const mech = await store.atomic({ run: (tables) => tables.mech() });

  if (Option.isNone(mech) || mech.value.status !== MechStatus.Active) {
    return;
  }

  const now = DateTime.nowUnsafe();
  const deliveries = await store.atomic({ run: (tables) => tables.pendingSlackDeliveries({ now }) });

  for (const delivery of deliveries) {
    await runSlackDelivery({ store, settings, mech: mech.value, delivery });
  }
}
