import { KeyUnrecognized } from '@mechane/protocol';

type BearerInput = { readonly authorization: string };

/** Reads one bearer value; malformed authorization never falls back to a browser session. */
export function bearerToken({ authorization }: BearerInput): string {
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  const token = match?.[1];

  if (token === undefined) {
    throw new KeyUnrecognized({});
  }

  return token;
}
