import type { ParsedSource } from '@mechane/modules';
import type { RolloutPhase, RuleTool } from '@mechane/rule-shapes';
import type { Option } from 'effect';
import type { FileUnwritable, InputUnreadable } from './errors.ts';

/**
 * What every owned check reads: the workspace's members, and every file git tracks or would track, relative to the
 * workspace. Each TypeScript file of the source roots comes parsed once for every check.
 */
export type CheckInput = {
  readonly members: ReadonlyArray<Member>;
  readonly files: ReadonlyArray<string>;
  readonly sources: ReadonlyArray<ParsedSource>;
};

/** What a normalizer leaves a file, relative to the workspace: its text. */
export type FileChange = {
  readonly path: string;
  /** Absent once the normalizer emptied the file, which it deletes. */
  readonly text: Option.Option<string>;
};

/** A rule its baseline holds: the key its sites count under, the tool that reports them, and its rollout. */
export type Ratchet = {
  readonly rule: string;
  readonly tool: RuleTool;
  readonly standard: string;
  readonly phase: RolloutPhase;
};

/** How many sites each file holds, by its path relative to the workspace. */
export type SiteCounts = Readonly<Record<string, number>>;

/** Every failure a command of the checks program ends with. */
export type ChecksFailure = InputUnreadable | FileUnwritable;

/**
 * A workspace member: its package name, its manifest's folder, empty for the root, and the members and installed
 * packages it depends on. It names its source roots and the folders its compiler configuration includes.
 */
export type Member = {
  readonly name: string;
  readonly folder: string;
  readonly internal: ReadonlyArray<string>;
  readonly external: ReadonlyArray<string>;
  readonly sourceRoots: ReadonlyArray<string>;
  readonly includedRoots: ReadonlyArray<string>;
};

/** One violation an owned check found; `location` is a path, with a line when the check knows it. */
export type Finding = { readonly check: string; readonly location: string; readonly message: string };

/**
 * One finding of a rule at a place in a file, before any baseline holds it. It names the rule's key, the file relative
 * to the workspace, its line from 1, and the message that teaches the fix.
 */
export type Site = { readonly rule: string; readonly file: string; readonly line: number; readonly message: string };

/** The parent variables a command's children inherit. */
export type InheritedInput = { readonly inherited: Readonly<Record<string, string>> };

export type ReadInput = { readonly path: string };

/** A file by its path and its whole text. */
export type TextFile = { readonly path: string; readonly text: string };
