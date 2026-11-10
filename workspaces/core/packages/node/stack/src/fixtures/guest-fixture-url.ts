import { LoopbackOrigin } from '@mechane/deployment';
import { Result, Schema } from 'effect';

const HTTP_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

/** Docker's host bridge gives guest fixtures an address distinct from the guest's own loopback. */
export function guestFixtureUrl(origin: URL): URL {
  const guest = new URL(origin.href);
  const probe = new URL(origin.href);

  probe.protocol = 'http:';

  const loopback = Schema.decodeUnknownResult(LoopbackOrigin)(probe.href);

  if (HTTP_PROTOCOLS.has(origin.protocol) && Result.isSuccess(loopback)) {
    guest.hostname = 'host.docker.internal';
  }

  return guest;
}
