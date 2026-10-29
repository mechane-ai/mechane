import { Duration } from 'effect';

/** The file in a fresh temporary folder that holds the Worker's two secrets while a deploy uploads them. */
export const SECRETS_FILE = 'secrets.json';

/** How long a deploy may take: Wrangler builds the sandbox image and pushes it to Cloudflare's registry first. */
export const DEPLOY_TIMEOUT = Duration.minutes(30);

/** How long a deploy waits for readiness; a first deploy also waits for the Custom Domain's certificate. */
export const READINESS_TIMEOUT = { first: Duration.minutes(5), later: Duration.minutes(2) } as const;

/** How long the readiness wait pauses between two reads. */
export const READINESS_INTERVAL = Duration.seconds(5);

/** The strategy of a deployment that gives each version a percentage of traffic; a rollback gives one all of it. */
export const PERCENTAGE_STRATEGY = 'percentage';

/**
 * What the sandbox image builds from, relative to the product workspace: the guest, every member it bundles, as its
 * `package.json` and theirs name them, and the lockfile.
 */
export const IMAGE_INPUTS = [
  'packages/node/guest',
  'packages/node/program',
  'packages/shared/deployment',
  'packages/shared/protocol',
  'packages/shared/records',
  'packages/shared/sandbox-wire',
  'pnpm-lock.yaml',
] as const;

/** The protocol's file of `RELEASE`, which every release changes and no image reads. */
export const RELEASE_FILE = 'packages/shared/protocol/src/release.ts';

/** The share of traffic a deployment sends to its one version, in percent: all of it. */
export const FULL_TRAFFIC_PERCENTAGE = 100;
