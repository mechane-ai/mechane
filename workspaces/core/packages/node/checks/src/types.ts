import type { Option } from 'effect';
import type { ChecksCommand } from './constants.ts';

/** What the checks program reads from its command line and environment. */
export type ChecksSettings = {
  readonly command: ChecksCommand;
  /**
   * The rule the fix command names before its paths, whose autofix it sweeps; absent for every other command, and for a
   * fix of every enforced rule.
   */
  readonly rule: Option.Option<string>;
  /**
   * The absolute paths the command line names after the command and a fix's rule: the files to lint or to fix, or a
   * merge's three versions.
   */
  readonly paths: ReadonlyArray<string>;
  /** The branch whose merge base with `HEAD` starts the changed set and caps each ratchet's baseline. */
  readonly baseBranch: string;
  /** The parent variables the checks' children inherit. */
  readonly inherited: Readonly<Record<string, string>>;
};
