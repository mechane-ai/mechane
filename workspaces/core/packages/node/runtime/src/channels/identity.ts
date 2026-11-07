import { createHash } from 'node:crypto';

const UUID_HEX = {
  firstEnd: 8,
  secondEnd: 12,
  versionEnd: 13,
  thirdEnd: 16,
  variantEnd: 17,
  fourthEnd: 20,
  lastEnd: 32,
} as const;

export function channelRecordId(value: string): string {
  const digest = createHash('sha256').update(value).digest('hex');

  return [
    digest.slice(0, UUID_HEX.firstEnd),
    digest.slice(UUID_HEX.firstEnd, UUID_HEX.secondEnd),
    `8${digest.slice(UUID_HEX.versionEnd, UUID_HEX.thirdEnd)}`,
    `a${digest.slice(UUID_HEX.variantEnd, UUID_HEX.fourthEnd)}`,
    digest.slice(UUID_HEX.fourthEnd, UUID_HEX.lastEnd),
  ].join('-');
}
