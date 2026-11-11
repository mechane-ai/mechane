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

/** The current API catalog, regenerated from declarations after an authorized interface change. */
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
