import { bearerAuthorization } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import { GUEST_PORT } from '@mechane/sandbox-wire';
import { Redacted } from 'effect';
import { httpGuest } from '../providers/http-guest.ts';
import type { GuestConnection, GuestTransport } from '../types.ts';

type TensorlakeGuestInput = { readonly origin: URL; readonly apiKey: Redacted.Redacted };

/** Authenticates to Tensorlake's port proxy, which strips Authorization before forwarding to the guest. */
export function tensorlakeGuest({ origin, apiKey }: TensorlakeGuestInput): GuestConnection {
  const guestOrigin = new URL(origin);
  guestOrigin.hostname = `${GUEST_PORT}-${guestOrigin.hostname}`;
  const token = Redacted.value(apiKey);
  const authorization = bearerAuthorization({ token });

  const fetchGuest: GuestTransport['fetch'] = ({ path, init }) => {
    const headers = new Headers(init.headers);

    headers.set(HttpHeader.Authorization, authorization);

    const url = new URL(path, guestOrigin);

    return fetch(url, { ...init, headers, redirect: 'manual' });
  };

  return httpGuest({ fetch: fetchGuest });
}
