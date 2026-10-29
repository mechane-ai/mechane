import type { BrowserIdentity, PrincipalId, WorkspaceId } from '@mechane/records';

/** Provider-qualified subjects keep identity ownership stable across display-name changes. */
export type IdentityKey = Pick<BrowserIdentity, 'provider' | 'subject'>;

/** The encoded principal ID shared by directory record operations. */
export type PrincipalInput = { readonly principalId: typeof PrincipalId.Encoded };

/** The encoded workspace ID shared by directory record operations. */
export type WorkspaceInput = { readonly workspaceId: typeof WorkspaceId.Encoded };

/** A membership belongs to exactly one principal and workspace. */
export type WorkspaceMembershipInput = PrincipalInput & WorkspaceInput;
