import type { ProcessFailed } from '@mechane/program';
import type { KeyMetadata } from '@mechane/protocol';
import type { ReleaseFailed } from '@mechane/release';
import type { Stack, StackFailed } from '@mechane/stack';
import type { BrowserRefused, CheckFailed, CliFailed, CliUndecoded, FileStepFailed } from './errors.ts';

/** A scenario's user: its own CLI configuration folder, the GitHub login it signs in as, and the CLI's variables. */
export type Account = {
  readonly login: string;
  readonly configurationRoot: string;
  readonly environment: Readonly<Record<string, string>>;
};

/** A token a scenario read from a credential file, and whether that file is private. */
export type PrivateToken = { readonly token: string; readonly isPrivate: boolean };

/** A key a scenario created: its metadata, its token and whether its file is private, and the run's output. */
export type CreatedKey = {
  readonly key: KeyMetadata;
  readonly token: string;
  readonly isPrivate: boolean;
  readonly output: string;
};

/** A successful run's decoded result, and everything it wrote, which a scenario searches for secrets. */
export type CliRun<A> = { readonly result: A; readonly output: string };

/** A refused run's one error code, and everything it wrote. */
export type CliRefusal = { readonly code: string; readonly output: string };

/** The stack a helper works on. */
export type StackInput = { readonly stack: Stack };

/** Text a secret must not appear in, under a name that says where it came from. */
export type SearchedText = { readonly name: string; readonly text: string };

/** What a scenario runs against: the stack, and its catalog entry's guarantee, which names its check. */
export type ScenarioInput = { readonly stack: Stack; readonly guarantee: string };

/**
 * Why a scenario stopped: a check failed, or a CLI run, a browser step, a file step, a release's build or the stack's
 * restart or publish failed.
 */
export type ScenarioFailure =
  | CheckFailed
  | CliFailed
  | CliUndecoded
  | ProcessFailed
  | BrowserRefused
  | FileStepFailed
  | ReleaseFailed
  | StackFailed;
