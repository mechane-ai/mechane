/** The local program's name, which prefixes each diagnostic it writes. */
export const PROGRAM = 'local';

/** The local launcher commands; an empty command starts the persistent installation. */
export const LocalCommand = { Default: '', Start: 'start', Fixture: 'fixture', Reset: 'reset --confirm' } as const;
export type LocalCommand = (typeof LocalCommand)[keyof typeof LocalCommand];

/** How the dev program ends: a stop signal ends a healthy stack, and a stack that failed ends the program as failed. */
export const DevStatus = { Stopped: 0, Failed: 1 } as const;

export type DevStatus = (typeof DevStatus)[keyof typeof DevStatus];

/** The folder in the stack's state folder that holds the release dev builds of this source. */
export const RELEASE_FOLDER = 'release';
