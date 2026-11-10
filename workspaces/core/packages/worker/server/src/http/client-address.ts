import { HttpHeader } from '@mechane/records';
import { isIP } from 'node:net';

type ClientAddressInput = {
  readonly request: Request;
  readonly peerAddress: string | null;
  readonly isTrustedProxy: boolean;
};

export function clientAddress({ request, peerAddress, isTrustedProxy }: ClientAddressInput): string | null {
  if (!isTrustedProxy) {
    return peerAddress;
  }

  const address = request.headers.get(HttpHeader.MechaneClientAddress);

  if (address === null || isIP(address) === 0) {
    return peerAddress;
  }

  return address;
}
