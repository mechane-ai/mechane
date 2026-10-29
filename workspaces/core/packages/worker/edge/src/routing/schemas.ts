import { Schema } from 'effect';
import { PEER_ADDRESS_PATTERN, PEER_COUNTRY_PATTERN } from './constants.ts';

/** The address of the client a request came from, as Cloudflare's edge sets it: IPv4 or IPv6 text. */
export const PeerAddress = Schema.String.check(Schema.isPattern(PEER_ADDRESS_PATTERN));

export type PeerAddress = typeof PeerAddress.Type;

/** The country Cloudflare's edge places the client in, among the properties it adds to a request. */
export const PeerCountry = Schema.Struct({ country: Schema.String.check(Schema.isPattern(PEER_COUNTRY_PATTERN)) });

export type PeerCountry = typeof PeerCountry.Type;
