import { Address4, Address6 } from 'ip-address';
import { resolve4, resolve6 } from 'node:dns/promises';

type HostPolicy = {
  readonly url: URL;
  readonly allowNonPublicLiterals?: boolean;
  readonly allowedHostnames: ReadonlySet<string>;
  readonly privateHostnames: ReadonlySet<string>;
};

const EMPTY_DNS_ANSWERS: ReadonlySet<string> = new Set(['ENODATA', 'ENOTFOUND']);

const privateV4: ReadonlyArray<Address4> = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'].map(
  (cidr) => new Address4(cidr),
);

const nonPublicV4: ReadonlyArray<Address4> = [
  '0.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.88.99.0/24',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
].map((cidr) => new Address4(cidr));

const globalV6: ReadonlyArray<Address6> = [new Address6('2000::/3')];

const nonPublicV6: ReadonlyArray<Address6> = ['2001::/23', '2001:db8::/32', '2002::/16', '3fff::/20'].map(
  (cidr) => new Address6(cidr),
);

async function addresses(
  lookup: (host: string) => Promise<ReadonlyArray<string>>,
  host: string,
): Promise<ReadonlyArray<string>> {
  try {
    return await lookup(host);
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      if (typeof error.code === 'string' && EMPTY_DNS_ANSWERS.has(error.code)) {
        return [];
      }
    }

    throw new Error('Managed host resolution failed', { cause: error });
  }
}

function permitsAddress(address: string, allowPrivate: boolean): boolean {
  if (Address4.isValid(address)) {
    const parsed = new Address4(address);

    if (nonPublicV4.some((subnet) => parsed.isInSubnet(subnet))) {
      return false;
    }

    return allowPrivate || !privateV4.some((subnet) => parsed.isInSubnet(subnet));
  }

  if (Address6.isValid(address)) {
    const parsed = new Address6(address);

    const isGlobal = globalV6.some((subnet) => parsed.isInSubnet(subnet));

    return isGlobal && !nonPublicV6.some((subnet) => parsed.isInSubnet(subnet));
  }

  return false;
}

export async function verifyManagedHost({
  url,
  allowedHostnames,
  privateHostnames,
  allowNonPublicLiterals = true,
}: HostPolicy): Promise<void> {
  const name = url.hostname;

  if (!allowedHostnames.has(name)) {
    throw new Error('Managed destination is not allowed');
  }

  const literal = name.replaceAll(/^\[|\]$/gu, '');
  const isV4 = Address4.isValid(literal);
  const isLiteral = isV4 || Address6.isValid(literal);
  const isLoopbackV4 = isV4 && literal.startsWith('127.');
  const loopback = name === 'localhost' || literal === '::1' || isLoopbackV4;

  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) {
    throw new Error('Managed destination requires HTTPS');
  }

  if (isLiteral || name === 'localhost') {
    if (allowNonPublicLiterals || permitsAddress(literal, privateHostnames.has(name))) {
      return;
    }

    throw new Error('Managed destination is outside its configured network policy');
  }

  const [v4, v6] = await Promise.all([addresses(resolve4, name), addresses(resolve6, name)]);
  const all = [...v4, ...v6];

  if (all.length === 0 || !all.every((address) => permitsAddress(address, privateHostnames.has(name)))) {
    throw new Error('Managed destination resolves outside its configured network policy');
  }
}
