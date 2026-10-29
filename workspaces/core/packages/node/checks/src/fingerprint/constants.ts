import { CACHE_FOLDER } from '@mechane/checks-kernel';

/** Bun's build targets: the Workers runtime builds as a browser, the CLI as Bun, and every other program as Node. */
export const BundleTarget = { Browser: 'browser', Bun: 'bun', Node: 'node' } as const;

export type BundleTarget = (typeof BundleTarget)[keyof typeof BundleTarget];

/** The role of the last line, which hashes every other line. */
export const TOTAL_ROLE = 'fingerprint';

/** The fingerprint the last green full check recorded, which `compare` reads. */
export const GREEN_FINGERPRINT = `${CACHE_FOLDER}green-fingerprint.txt`;
