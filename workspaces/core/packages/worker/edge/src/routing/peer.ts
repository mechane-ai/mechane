import { RequestInvalid } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import { Effect, Option, Schema } from 'effect';
import { PeerAddress, PeerCountry } from './schemas.ts';
import type { Peer, PeerInput } from './types.ts';

/**
 * Where a request came from, as Cloudflare's edge reports it: the client's address and country. A local stack's runtime
 * reports neither, so no address policy applies there; an address header that holds no address is refused.
 */
export function peer({ request }: PeerInput): Effect.Effect<Peer, RequestInvalid> {
  const country = Schema.decodeUnknownOption(PeerCountry)(request.cf).pipe(Option.map((reported) => reported.country));

  return Schema.decodeUnknownEffect(Schema.NullOr(PeerAddress))(request.headers.get(HttpHeader.ConnectingIp)).pipe(
    Effect.map((address) => ({ address: Option.fromNullishOr(address), country })),
    Effect.mapError(() => new RequestInvalid({ reason: `the ${HttpHeader.ConnectingIp} header holds no address` })),
  );
}
