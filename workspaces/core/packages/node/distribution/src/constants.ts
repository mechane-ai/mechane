import { fileURLToPath } from 'node:url';

const CORE_URL: Readonly<URL> = new URL('../../../../', import.meta.url);
const SOURCE_URL: Readonly<URL> = new URL('../../../../../../', import.meta.url);

/** The product workspace that owns the build tasks and compatibility locks. */
export const CORE_FOLDER = fileURLToPath(CORE_URL);
/** The public repository root that supplies release provenance and notices. */
export const SOURCE_FOLDER = fileURLToPath(SOURCE_URL);

/** The public source repository named by product release provenance. */
export const PUBLIC_REPOSITORY = 'mechane-ai/mechane';
/** The installation manifest and artifact receipt format supported by this builder. */
export const FORMAT_VERSION = 1;
/** The module-relative path that OpenTofu uploads as the Worker module. */
export const WORKER_FILENAME = 'worker.js';
/** Files every published module must include from the public infrastructure source. */
export const MODULE_SOURCE_NAMES = ['main.tf', 'outputs.tf', 'variables.tf', 'versions.tf', 'README.md'] as const;
/** License texts that must accompany the executable module. */
export const MODULE_NOTICE_NAMES = ['LICENSE', 'NOTICE'] as const;
/** OCI's descriptor byte count, kept under its mandated wire name. */
export const OCI_SIZE_KEY = 'size';
/** The declarative state of each current SQLite Durable Object export. */
export const DURABLE_EXPORT = { type: 'durable-object', storage: 'sqlite', state: 'created' } as const;
/** An OCI descriptor digest, including its required hash algorithm. */
export const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
/** Plain filenames accepted by both the artifact receipt and GitHub uploads. */
export const ASSET_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]+$/;
/** The artifact operations available to a publisher or an offline check. */
export const DistributionMode = { Build: 'build', Verify: 'verify', Preview: 'preview-module' } as const;
export type DistributionMode = (typeof DistributionMode)[keyof typeof DistributionMode];

/** The operation that each distribution failure reports. */
export const DistributionStep = {
  Settings: 'read distribution settings',
  Source: 'verify public release source',
  Command: 'run release build command',
  Read: 'read distribution input',
  Write: 'write distribution artifact',
  Verify: 'verify distribution artifact',
} as const;

export type DistributionStep = (typeof DistributionStep)[keyof typeof DistributionStep];
