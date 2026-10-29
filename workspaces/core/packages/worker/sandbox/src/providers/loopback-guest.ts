import type { GuestConnection, GuestTransport } from '../types.ts';
import { httpGuest } from './http-guest.ts';

/** The launcher's loopback host, and the port a machine's guest listens on there. */
type LoopbackGuestInput = { readonly launcherOrigin: URL; readonly port: number };

/** A host machine's guest, which listens on the launcher's loopback host at the port it reported. */
export function loopbackGuest({ launcherOrigin, port }: LoopbackGuestInput): GuestConnection {
  const fetchGuest: GuestTransport['fetch'] = async ({ path, init }) => {
    const url = new URL(path, launcherOrigin);

    url.port = String(port);

    return await fetch(url, init);
  };

  return httpGuest({ fetch: fetchGuest });
}
