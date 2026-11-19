import { Schema } from 'effect';
import { isIP } from 'node:net';
import { getDomain } from 'tldts';

const DOMAIN_MAX_ITEMS = 64;
const DOMAIN_MAX_CHARACTERS = 255;

const DomainList = Schema.Array(Schema.NonEmptyString.check(Schema.isMaxLength(DOMAIN_MAX_CHARACTERS))).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(DOMAIN_MAX_ITEMS),
);

const hostnameLabel = /^(?!-)[a-z0-9_-]{1,63}(?<!-)$/u;
const localSuffixes = ['localhost', 'local', 'internal', 'localdomain', 'invalid'] as const;

function webDomainUrl(hostname: string): string {
  return `https://${hostname}`;
}

function normalizeDomain(value: string, isPathAllowed: boolean): string {
  const [host = '', ...segments] = value.split('/');
  const hostname = host.toLowerCase();
  const path = segments.join('/');

  if (!hostname.split('.').every((label) => hostnameLabel.test(label))) {
    throw new Error('Web domain lists require plain hostnames');
  }

  const parsed = URL.parse(webDomainUrl(hostname));

  if (parsed === null || isIP(parsed.hostname) !== 0 || localSuffixes.some((suffix) => hostWithin(hostname, suffix))) {
    throw new Error('IP addresses and local hostnames cannot be web tool domains');
  }

  if (getDomain(hostname, { allowPrivateDomains: true, validateHostname: false }) === null) {
    throw new Error('A web tool domain must include a registrable domain');
  }

  const hasUnexpectedPath = path.length > 0 && !isPathAllowed;

  if (hasUnexpectedPath || /[\s?#$,|^!\\]/u.test(path)) {
    throw new Error('Invalid path in web tool domain');
  }

  if (path.length === 0) {
    return hostname;
  }

  return `${hostname}/${path}`;
}

export function hostWithin(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function managedWebDomains(input: unknown, isPathAllowed: boolean): ReadonlyArray<string> | undefined {
  if (input === undefined || input === null) {
    return undefined;
  }

  const entries = Schema.decodeUnknownSync(DomainList)(input).map((value) => normalizeDomain(value, isPathAllowed));

  if (new Set(entries).size !== entries.length) {
    throw new Error('Web tool domains must be distinct');
  }

  return entries;
}
