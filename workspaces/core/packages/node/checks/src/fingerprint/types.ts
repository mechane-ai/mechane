import type { BundleTarget } from './constants.ts';

/**
 * One fingerprint bundle: its role, entry module relative to the workspace, target runtime, omitted modules, and
 * resolution conditions.
 */
export type BundleEntry = {
  readonly role: string;
  readonly entry: string;
  readonly target: BundleTarget;
  readonly externals: ReadonlyArray<string>;
  readonly conditions: ReadonlyArray<string>;
};

/** One line of the fingerprint: a role and the hash of its content. */
export type RoleHash = { readonly role: string; readonly hash: string };
