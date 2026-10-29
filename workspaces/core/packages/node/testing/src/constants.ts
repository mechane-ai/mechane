import type { ServerFailure } from '@mechane/protocol';
import { join } from 'node:path';

/**
 * The CLI binary that `mise run build:cli` compiles; the smoke drives the built program, not its source. Knip takes a
 * `new URL` of `import.meta.url` for an import and would parse the 91 MB binary, so the path joins the folder.
 */
export const CLI_BINARY = join(import.meta.dirname, '..', '..', 'cli', 'dist', 'mechane');

/** The error codes with which the deployment refuses a revoked and an expired key, and a suspended workspace. */
export const RefusalCode = {
  Revoked: 'KeyRevoked',
  Expired: 'KeyExpired',
  Suspended: 'WorkspaceSuspended',
  SandboxDisabled: 'SandboxDisabled',
} as const satisfies Readonly<Record<string, ServerFailure['_tag']>>;

/**
 * What a CLI run failed to do. It did not exit with the status the scenario expects, refuse, name an approval page,
 * keep following until its event came, or write that event in time.
 */
export const CliStep = { Exit: 'exit', Refuse: 'refuse', Notice: 'notice', Follow: 'follow', Await: 'await' } as const;

export type CliStep = (typeof CliStep)[keyof typeof CliStep];

/** The steps of a person's browser through a device approval, and of a client that starts or posts one on its own. */
export const BrowserStep = {
  OpenDevicePage: 'open-device-page',
  SignIn: 'sign-in',
  ReturnFromGitHub: 'return-from-github',
  Open: 'open',
  PostForm: 'post-form',
  ShowCodeForm: 'show-code-form',
  ReviewCode: 'review-code',
  Approve: 'approve',
  ApproveWithKey: 'approve-with-key',
  StartApproval: 'start-approval',
} as const;

export type BrowserStep = (typeof BrowserStep)[keyof typeof BrowserStep];

/** The steps a scenario takes on a file or a folder, which a failed one names with its path. */
export const FileStep = {
  Create: 'create',
  Read: 'read',
  List: 'list',
  Write: 'write',
  Decode: 'decode',
  Await: 'await',
} as const;

export type FileStep = (typeof FileStep)[keyof typeof FileStep];
