/** The kind of limiter a policy counts in, and what one request of it counts by. */
type LimiterObjectNameInput = { readonly kind: string; readonly countedBy: string };

type CountedKeyInput = { readonly countedBy: string };

/** The groups an IPv6 address has. */
const IPV6_GROUPS = 8;

/** The groups of an IPv6 address's /64, the part one subscriber is given whole. */
const IPV6_PREFIX_GROUPS = 4;

/** The radix of an IPv6 address's groups, which its text writes in hexadecimal. */
const IPV6_GROUP_RADIX = 16;

/**
 * The name of a limiter's object: its kind and what it counts by, so every policy of one address, principal or GitHub
 * user counts in one object.
 */
export function limiterObjectName({ kind, countedBy }: LimiterObjectNameInput): string {
  const counted = countedKey({ countedBy });

  return `${kind}:${counted}`;
}

/**
 * What a limiter counts by: an IPv6 address by its /64, which one subscriber is given whole. Anything else counts
 * whole, an IPv4 address and an IPv4 address written in IPv6 among them.
 */
function countedKey({ countedBy }: CountedKeyInput): string {
  if (!countedBy.includes(':') || countedBy.includes('.')) {
    return countedBy;
  }

  const written = countedBy.split(':').filter((group) => group !== '').length;

  const groups = countedBy
    .replace('::', `:${'0:'.repeat(IPV6_GROUPS - written)}`)
    .split(':')
    .filter((group) => group !== '');

  /** A group written without its leading zeros, as the address's canonical form writes it. */
  const canonicalGroup: (group: string) => string = (group) =>
    Number.parseInt(group, IPV6_GROUP_RADIX).toString(IPV6_GROUP_RADIX);

  const prefix = groups.slice(0, IPV6_PREFIX_GROUPS).map(canonicalGroup).join(':');

  return `${prefix}::/64`;
}
