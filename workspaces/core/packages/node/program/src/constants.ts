import { TokenPrefix } from '@mechane/protocol';
import { Record } from 'effect';

/** The spaces each level of a JSON file the programs write is indented by. */
export const JSON_INDENT_CHARS = 2;

/**
 * The migration lock, relative to the product workspace: a hash of each schema step of every store and of each Wrangler
 * migration, in order, which only ever gains steps.
 */
export const MIGRATION_LOCK = 'lint/migrations.json';

/** Where a program's own arguments start in `process.argv`, after the runtime's path and the script's. */
export const PROGRAM_ARGUMENTS_START = 2;

/** What `mechane update` reports: nothing newer, a newer release to install, or the release it installed. */
export const UpdateOutcome = { UpToDate: 'up_to_date', Available: 'available', Updated: 'updated' } as const;

export type UpdateOutcome = (typeof UpdateOutcome)[keyof typeof UpdateOutcome];

/**
 * The wire lock, relative to the product workspace: every name a shipped format carries, by kind. A name joins it once
 * and stays, so a rename or a removal of a shipped name fails the check.
 */
export const WIRE_LOCK = 'lint/wire.json';

/** The kinds of name the wire lock holds, each under its own key. */
export const WireKind = {
  Operations: 'operations',
  Fields: 'fields',
  Members: 'members',
  Errors: 'errors',
  Families: 'families',
  CliErrors: 'cli_errors',
  ExitStatuses: 'exit_statuses',
  Events: 'events',
  Commands: 'commands',
  Flags: 'flags',
  Variables: 'variables',
} as const;

export type WireKind = (typeof WireKind)[keyof typeof WireKind];

/** The exit status with which a process reports success, by the operating system's convention. */
export const SUCCESS_STATUS = 0;

/** The mode of a file or folder only its owner may read and write, such as a secrets file and its folder. */
export const PrivateMode = { File: 0o600, Folder: 0o700 } as const;

/** The bits of a file's mode that grant access. */
export const PERMISSION_BITS = 0o777;

/** The prefix GitHub gives its OAuth access tokens, which the local GitHub's tokens copy. */
export const GITHUB_TOKEN_PREFIX = 'gho_';

/**
 * Text shaped like a secret token: a prefix the deployment or GitHub gives its tokens, then a long run of URL-safe
 * characters. A stored hash is unprefixed hex, so only a raw token matches, wherever a run left it.
 */
export const TOKEN_SHAPE: Readonly<RegExp> = new RegExp(
  `(?:${[...Record.values(TokenPrefix), GITHUB_TOKEN_PREFIX].join('|')})[\\w-]{32,}`,
);
