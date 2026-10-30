import type { ReleaseMode } from './constants.ts';

/** What the release program reads from its command line and environment. */
export type ReleaseSettings = {
  readonly mode: ReleaseMode;
  /** The parent variables the mode's children inherit. */
  readonly inherited: Readonly<Record<string, string>>;
};

/** The parent variables a release's children inherit. */
export type InheritedInput = { readonly inherited: Readonly<Record<string, string>> };

export type InheritedVariablesInput = { readonly names: ReadonlyArray<string> };
