import { FileStep } from '@mechane/program';
import { Duration } from 'effect';

/** Where the key a command sent came from: the saved login, or the API key variable. */
export const CredentialSource = { SavedLogin: 'saved_login', Variable: 'variable' } as const;

export type CredentialSource = (typeof CredentialSource)[keyof typeof CredentialSource];

/** How long a command waits for the deployment's whole answer before it fails as unavailable. */
export const REQUEST_TIMEOUT = Duration.seconds(30);

/**
 * How a run that wrote its results ended: all its work completed, or part of it could not, such as an eval's trial that
 * failed to run or grade.
 */
export const RunOutcome = { Completed: 'completed', Incomplete: 'incomplete' } as const;

export type RunOutcome = (typeof RunOutcome)[keyof typeof RunOutcome];

/** What a command line asks the program to do, or the usage error of one that does not decode. */
export const InvocationKind = { Help: 'help', Version: 'version', Command: 'command', Usage: 'usage' } as const;

export type InvocationKind = (typeof InvocationKind)[keyof typeof InvocationKind];

/** The steps on the CLI's private files that can fail: a file's own steps, a read, a decode and a new folder. */
export const CredentialsStep = {
  ...FileStep,
  Read: 'read',
  Decode: 'decode',
  CreateFolder: 'create the folder',
} as const;

export type CredentialsStep = (typeof CredentialsStep)[keyof typeof CredentialsStep];
