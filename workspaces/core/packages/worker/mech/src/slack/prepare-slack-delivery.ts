import { Option } from 'effect';
import { blockSlackDelivery } from './block-slack-delivery.ts';
import { readSlackDestination } from './read-slack-destination.ts';
import { resolveSlackClient } from './resolve-slack-client.ts';
import type { PreparedSlackDelivery, RunSlackDeliveryInput } from './types.ts';

/** Checks live binding permission and resolves credentials before freezing its destination. */
export async function prepareSlackDelivery({
  store,
  settings,
  mech,
  delivery,
}: RunSlackDeliveryInput): Promise<Option.Option<PreparedSlackDelivery>> {
  const destination = await readSlackDestination({ store, settings, mech, delivery });

  if (Option.isNone(destination)) {
    return Option.none();
  }

  const client = resolveSlackClient({ settings, mech, destination: destination.value });

  if (Option.isNone(client)) {
    await blockSlackDelivery({ store, delivery, reason: 'connection_or_credential_unavailable' });

    return Option.none();
  }

  await store.atomic({
    run: (tables) => tables.resolveSlackDelivery({ deliveryId: delivery.id, destination: destination.value }),
  });

  return client;
}
