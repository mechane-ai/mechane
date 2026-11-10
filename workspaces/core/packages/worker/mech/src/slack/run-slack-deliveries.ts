import { DateTime, Option } from 'effect';
import { runSlackDelivery } from './run-slack-delivery.ts';
import type { RunSlackDeliveriesInput } from './types.ts';

/** Runs due outbox work; the store admits intake notices even while agent work is paused. */
export async function runSlackDeliveries({ store, settings }: RunSlackDeliveriesInput): Promise<void> {
  const mech = await store.atomic({ run: (tables) => tables.mech() });

  if (Option.isNone(mech)) {
    return;
  }

  const now = DateTime.nowUnsafe();
  const deliveries = await store.atomic({ run: (tables) => tables.pendingSlackDeliveries({ now }) });

  for (const delivery of deliveries) {
    await runSlackDelivery({ store, settings, mech: mech.value, delivery });
  }
}
