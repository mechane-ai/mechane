import type { AstGrepRule, MemberEntry, OxlintRule, RuleAsset } from '@mechane/rule-shapes';

/** A file the registry generates: its path relative to the workspace, and its text. */
export type GeneratedFile = { readonly path: string; readonly text: string };

/** The words of each word list of the registry's vocabulary. */
export type WordLists = {
  readonly units: ReadonlyArray<string>;
  readonly countedNouns: ReadonlyArray<string>;
  readonly acronyms: ReadonlyArray<string>;
};

/** A contract as its file holds it: its name, its folder's without the number, its path and its text. */
export type ContractText = { readonly name: string; readonly path: string; readonly text: string };

/** A rule that loads an installed file in place, and that file, which only an oxlint or ast-grep rule names. */
export type LoadedAsset = { readonly rule: OxlintRule | AstGrepRule; readonly asset: RuleAsset };

/**
 * A rule that loads an installed file in place, with the contract that ships the file and the file's path from the
 * workspace. That is a path `.oxlintrc.json` extends, or a rule folder `sgconfig.yml` lists.
 */
export type AssetEntry = LoadedAsset & { readonly contract: ContractText; readonly path: string };

/** One exit status of the CLI: its name in the command model, and the status a process ends with. */
export type ExitStatus = { readonly name: string; readonly status: number };

/**
 * A member of `dependencies.json` that holds a package in the workspace: its name, and its folder relative to the
 * workspace, empty for the root. It carries the source roots its program includes and its manifest entry.
 */
export type WorkspaceMember = {
  readonly name: string;
  readonly folder: string;
  readonly roots: ReadonlyArray<string>;
  readonly entry: MemberEntry;
};
