import { MACHINE_LEASE } from '@mechane/rpc';
import { GUEST_PORT } from '@mechane/sandbox-wire';
import { Duration, Option } from 'effect';
import type { GuestConnection, GuestTransport } from '../types.ts';
import { httpGuest } from './http-guest.ts';
import type { ContainerProviderInput } from './types.ts';

/** The origin a container guest's requests are written against; the runtime sends them to the container's port. */
const CONTAINER_ORIGIN = 'http://machine.invalid';

type ContainerGuestInput = Pick<ContainerProviderInput, 'container'>;

/** Connects to a running local container and renews its inactivity lease. */
export async function containerGuest({ container }: ContainerGuestInput): Promise<Option.Option<GuestConnection>> {
  if (!container.running) {
    return Option.none();
  }

  const timeout = Duration.toMillis(MACHINE_LEASE);

  await container.setInactivityTimeout(timeout);

  const port = container.getTcpPort(GUEST_PORT);

  const fetchGuest: GuestTransport['fetch'] = ({ path, init }) => {
    const url = new URL(path, CONTAINER_ORIGIN);

    return port.fetch(url, init);
  };

  const guest = httpGuest({ fetch: fetchGuest });

  return Option.some(guest);
}
