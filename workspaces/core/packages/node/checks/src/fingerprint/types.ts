import type { BundleTarget } from './constants.ts';

/**
 * One bundle of the fingerprint: its role, its entry module relative to the workspace, the runtime it targets, and the
 * modules it leaves out.
 */
export type BundleEntry = {
  readonly role: string;
  readonly entry: string;
  readonly target: BundleTarget;
  readonly externals: ReadonlyArray<string>;
};

/** One line of the fingerprint: a role and the hash of its content. */
export type RoleHash = { readonly role: string; readonly hash: string };
