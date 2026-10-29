import type { ModelOffer } from '@mechane/deployment';
import { GITHUB_TOKEN_PREFIX } from '@mechane/program';
import { fileURLToPath } from 'node:url';

/** Random bytes in each local service credential and the persistent bootstrap secret. */
export const SECRET_BYTES = 32;

/** What starts a line of a person's script that the scripted upstream runs as a command, as a shell prompt does. */
export const COMMAND_PREFIX = '$ ';

/**
 * What starts a line of a person's message that holds the answer's stream open. Such a line waits the milliseconds it
 * names between the answer's first chunk and its last, as a long reply streams.
 */
export const HOLD_PREFIX = '~ ';

/**
 * The OAuth App the local GitHub registers for the stack, the login its sign-in form offers by default, and the prefix
 * its access tokens carry, as GitHub's own do. The stack draws a fresh client secret each time it starts.
 */
export const LOCAL_GITHUB = {
  clientId: 'mechane-local',
  login: 'mechane-dev',
  accessTokenPrefix: GITHUB_TOKEN_PREFIX,
} as const;

/**
 * What starts a line of a person's message whose rest the scripted upstream answers with in place of an echo, such as
 * the grade an eval's grader writes. The first such line answers.
 */
export const REPLY_PREFIX = '> ';

/**
 * The scripted upstream's offers. The echo, `scripted`, costs 1 dollar per million input tokens and 4 per million
 * output tokens, so a day's allowance covers many of its dispatches. The costly one costs ten thousand times as much:
 * an empty context's bound of about 86 dollars passes a day's allowance of 20 and a mech's cap of 10.
 */
export const SCRIPTED_OFFERS: Readonly<Record<'echo' | 'costly', ModelOffer>> = {
  echo: {
    id: 'scripted',
    contextWindowTokens: 32_768,
    maxOutputTokens: 1024,
    inputMicrosPerMillionTokens: 1_000_000,
    outputMicrosPerMillionTokens: 4_000_000,
    cacheReadMicrosPerMillionTokens: 100_000,
    cacheWriteMicrosPerMillionTokens: 1_250_000,
  },
  costly: {
    id: 'scripted-costly',
    contextWindowTokens: 32_768,
    maxOutputTokens: 1024,
    inputMicrosPerMillionTokens: 10_000_000_000,
    outputMicrosPerMillionTokens: 40_000_000_000,
    cacheReadMicrosPerMillionTokens: 10_000_000_000,
    cacheWriteMicrosPerMillionTokens: 10_000_000_000,
  },
};

/** The guest module `mise run build:guest` writes: the bytes the sandbox image copies, which host machines run. */
export const GUEST_BUNDLE = fileURLToPath(new URL('../../guest/image/guest.mjs', import.meta.url));

/** The files of a staged project; celld requires `main` inside the project folder. */
export const STAGED_FILES = { bundle: 'worker.js', configuration: 'wrangler.json', variables: '.dev.vars' } as const;

/** The parts of a stack's state folder, whose name starts with `prefix` below the state root. */
export const STATE_LAYOUT = {
  prefix: 'mechane-stack-',
  project: 'project',
  log: 'celld.log',
  sandboxes: 'sandboxes',
} as const;

/** The folder of the staged project in which `celld dev` keeps its state, and its object store's file there. */
const CELLD_STATE_FOLDER = ['.celld', 'dev'] as const;

const OBJECT_STORE_FILE = 'objects.sqlite3';

/**
 * The folder of the staged project in which `celld dev` keeps each Durable Object's own database. Its object store
 * beside that folder also holds the deployment, with the staged variables as a deployment's secrets are held.
 */
export const CELLD_OBJECTS_FOLDER = [...CELLD_STATE_FOLDER, 'runtime'] as const;

/**
 * The file of celld dev's local object store, a SQLite database, below the staged project. Its `objects` table holds
 * the deployment and every R2 object, each at `r2/<bucket_name>/<key>`, as celld 0.6.3's `local_store.rs` writes it.
 */
export const CELLD_OBJECT_STORE = [...CELLD_STATE_FOLDER, OBJECT_STORE_FILE] as const;

/**
 * The files of a state folder that hold the staged variables in plain text, including a local installation's model key.
 * They are `.dev.vars` and celld's object store with its record of the deployment, which SQLite may split in three.
 */
export const STAGED_VARIABLE_FILES = [
  [STATE_LAYOUT.project, STAGED_FILES.variables],
  [STATE_LAYOUT.project, ...CELLD_STATE_FOLDER, OBJECT_STORE_FILE],
  [STATE_LAYOUT.project, ...CELLD_STATE_FOLDER, `${OBJECT_STORE_FILE}-wal`],
  [STATE_LAYOUT.project, ...CELLD_STATE_FOLDER, `${OBJECT_STORE_FILE}-shm`],
] as const;

/** The host celld listens on, so nothing outside this machine reaches a local stack. */
export const LOOPBACK_HOST = '127.0.0.1';

/** The steps of starting, serving and stopping the local stack, each as the diagnostic of its failure words it. */
export const StackStep = {
  ReadSandboxProvider: 'read the sandbox provider variable',
  ReadLocalSettings: 'read the local stack settings',
  ReadLocalState: 'read the local stack state',
  WriteLocalState: 'write the local stack state',
  LockLocalState: 'lock the local stack state',
  ResetLocalState: 'reset the local stack state',
  CreateStateFolder: 'create a state folder',
  ReadWorkerRevision: 'read the Worker revision with git describe',
  Listen: 'listen on the loopback host',
  StartHostSandboxes: 'start host sandboxes',
  ReadWranglerConfiguration: 'read the Wrangler configuration',
  CopyWorkerBundle: 'copy the Worker bundle that mise run build:worker writes',
  WriteConfiguration: 'write the staged Wrangler configuration',
  WriteVariables: 'write the staged variables',
  OpenCelldLog: 'open the celld log',
  StartCloudflare: 'start the offline Cloudflare runtime',
  StartCelld: 'start celld',
  KillCelld: 'kill celld and its child runtime',
  AwaitCelld: 'wait for celld and the Worker to answer',
  RunCelld: 'run celld dev',
  ReadCelldLog: 'read the celld log',
  FindReleasesBucket: 'find the releases bucket of the Wrangler configuration',
  ReadReleaseFile: 'read a release file',
  PutReleaseFile: "put a release file in celld's object store",
} as const;

export type StackStep = (typeof StackStep)[keyof typeof StackStep];
