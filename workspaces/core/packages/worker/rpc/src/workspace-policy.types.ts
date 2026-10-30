import type { WorkspacePolicy } from '@mechane/protocol';
import type { Micros } from '@mechane/records';

/** The directory's original allowance seeds workspaces that have no explicit policy yet. */
export type ReadWorkspacePolicyInput = { readonly initialAllowanceMicros: typeof Micros.Encoded };

export type SaveWorkspacePolicyInput = {
  readonly policy: typeof WorkspacePolicy.Encoded;
  readonly isCreateOnly: boolean;
};
