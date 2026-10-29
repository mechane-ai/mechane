import type { ReleaseMode } from './constants.ts';

/** What the release program reads from its command line and environment. */
export type ReleaseSettings = {
  readonly mode: ReleaseMode;
  /** The parent variables the mode's children inherit. */
  readonly inherited: Readonly<Record<string, string>>;
};

export type UploadReleaseInput = {
  readonly directory: string;
  readonly bucket: string;
  readonly inherited: Readonly<Record<string, string>>;
};

/** The parent variables a release's children inherit. */
export type InheritedInput = { readonly inherited: Readonly<Record<string, string>> };

export type InheritedVariablesInput = { readonly names: ReadonlyArray<string> };

/** A key of production's bucket, and the variables Wrangler inherits to read it. */
export type BucketKeyInput = {
  readonly bucket: string;
  readonly key: string;
  readonly inherited: Readonly<Record<string, string>>;
};

/** A folder of built releases, and the variables git inherits to read the working tree's revision. */
export type BuiltFromTreeInput = { readonly folder: string; readonly inherited: Readonly<Record<string, string>> };
