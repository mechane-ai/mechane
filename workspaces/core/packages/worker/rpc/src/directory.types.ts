import type { IdentitySubjects } from '@mechane/deployment';
import type { catalog, DeviceApprovalRequest, KeyAccessAnswer } from '@mechane/protocol';
import type { BrowserSessionRequest, StateHashInput, TokenHashInput } from '@mechane/records';
import type {
  ApprovalClaim,
  ApprovalDecision,
  DirectoryKeyPage,
  DirectoryWorkspaces,
  KeyRevocation,
  KeyTokenAnswer,
  LiveSession,
  PendingApproval,
  SignInClaim,
  WorkspaceMembership,
} from './directory.schemas.ts';
import type {
  SharedWorkspaceCreation,
  WorkspaceMemberChangeAnswer,
  WorkspaceMembersAnswer,
} from './workspace-members.schemas.ts';
import type { ChangeWorkspaceMemberInput, CreateSharedWorkspaceInput } from './workspace-members.types.ts';
import type { WorkspacePresence } from './workspace-policy.schemas.ts';

/** Each RPC method of the directory. */
type DirectoryMethods = {
  readonly workspaceExists: (input: WorkspaceIdInput) => typeof WorkspacePresence.Encoded;
  readonly createSharedWorkspace: (input: CreateSharedWorkspaceInput) => typeof SharedWorkspaceCreation.Encoded;
  readonly workspaceMembers: (input: WorkspaceMembershipInput) => typeof WorkspaceMembersAnswer.Encoded;
  readonly changeWorkspaceMember: (input: ChangeWorkspaceMemberInput) => typeof WorkspaceMemberChangeAnswer.Encoded;
  readonly principalIdentities: (input: PrincipalIdInput) => typeof IdentitySubjects.Encoded;
  /** The count of schema migrations the directory's database has applied. */
  readonly schemaRevision: () => number;
  readonly openDeviceApproval: (input: DeviceApprovalOpening) => void;
  readonly pendingDeviceApproval: (input: UserCodeInput) => typeof PendingApproval.Encoded;
  readonly approveDeviceApproval: (input: ApproveDeviceApprovalInput) => typeof ApprovalDecision.Encoded;
  readonly claimDeviceApproval: (input: ClaimDeviceApprovalInput) => typeof ApprovalClaim.Encoded;
  readonly keyAccess: (input: TokenHashInput) => typeof KeyAccessAnswer.Encoded;
  /** The model spend the workspace may make each UTC day, which its mechs' dispatches reserve against. */
  readonly dailyAllowanceMicros: (input: WorkspaceIdInput) => number;
  readonly keysOfPrincipal: (input: KeysOfPrincipalQuery) => typeof DirectoryKeyPage.Encoded;
  readonly keyTokenHash: (input: OwnedKey) => typeof KeyTokenAnswer.Encoded;
  readonly revokeKey: (input: OwnedKey) => typeof KeyRevocation.Encoded;
  readonly workspacesOfPrincipal: (input: PrincipalIdInput) => typeof DirectoryWorkspaces.Encoded;
  readonly workspaceMembership: (input: WorkspaceMembershipInput) => typeof WorkspaceMembership.Encoded;
  readonly openBrowserSession: (input: BrowserSessionOpening) => void;
  readonly liveBrowserSession: (input: TokenHashInput) => typeof LiveSession.Encoded;
  readonly openSignIn: (input: SignInOpening) => void;
  readonly claimSignIn: (input: StateHashInput) => typeof SignInClaim.Encoded;
};

/**
 * The methods the directory serves by RPC, each answering with plain data the Worker decodes. The bindings name the
 * object by this type, so they need not import the object.
 */
export type DirectoryRpc = Rpc.DurableObjectBranded & DirectoryMethods;

/** A browser session's approval of the pending device approval with the user code. */
export type ApproveDeviceApprovalInput = {
  readonly userCode: string;
  readonly sessionTokenHash: string;
  /** The allowance a workspace that this approval signs up starts with. */
  readonly dailyAllowanceMicros: number;
};

/** A browser session to open; the directory sets its creation and expiry times by its own clock. */
export type BrowserSessionOpening = { readonly session: BrowserSessionRequest; readonly lifetimeMs: number };

/** A poll's claim; the caller generates the key's id and token, and the directory stores only the token's hash. */
export type ClaimDeviceApprovalInput = {
  readonly pollTokenHash: string;
  readonly keyId: string;
  readonly keyTokenHash: string;
};

/** A device approval to open; the directory sets its creation and expiry times by its own clock. */
export type DeviceApprovalOpening = { readonly approval: DeviceApprovalRequest; readonly lifetimeMs: number };

/** A page of the principal's keys, as the Worker asks for it. */
export type KeysOfPrincipalQuery = PrincipalIdInput & { readonly query: typeof catalog.listKeys.query.Encoded };

export type PrincipalIdInput = { readonly principalId: string };

/** A sign-in to open; the directory sets its creation and expiry times by its own clock. */
export type SignInOpening = { readonly signIn: StateHashInput; readonly lifetimeMs: number };

export type UserCodeInput = { readonly userCode: string };

export type WorkspaceIdInput = { readonly workspaceId: string };

export type WorkspaceMembershipInput = PrincipalIdInput & WorkspaceIdInput;

/** A key by its id, as the principal that owns it names it. */
export type OwnedKey = { readonly principalId: string; readonly keyId: string };
