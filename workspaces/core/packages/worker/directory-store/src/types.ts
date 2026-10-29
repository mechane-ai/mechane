import type { DeviceApprovalRequest, KeyRow, MembershipRole } from '@mechane/protocol';
import type { BrowserIdentity, BrowserSessionRequest, Micros, StateHashInput, WorkspaceId } from '@mechane/records';
import type { DatabaseFunctions, PageAfterInput } from '@mechane/store';
import type { Array, DateTime, Option } from 'effect';
import type { IdentityKey, PrincipalInput, WorkspaceInput, WorkspaceMembershipInput } from './inputs.types.ts';
import type { ClaimedSignInRow, DeviceApprovalRow, KeyRowPage, PrincipalRow, WorkspaceRow } from './schemas.ts';
import type { WorkspaceRecords } from './workspaces/workspace-records.ts';

/** What the directory's store does with device approvals. */
export type DeviceApprovalRecords = {
  /** Stores a new device approval, after forgetting every approval that expired before it was created. */
  readonly openDeviceApproval: (input: OpenDeviceApprovalInput) => void;
  /** The unexpired approval with the user code that no principal approved yet. */
  readonly pendingDeviceApproval: (input: PendingDeviceApprovalInput) => Option.Option<DeviceApprovalRow>;
  /** The unexpired approval with the poll token's hash whose key no poll claimed yet. */
  readonly claimableDeviceApproval: (input: ClaimableDeviceApprovalInput) => Option.Option<DeviceApprovalRow>;
  /** Records the principal that approved the device approval. */
  readonly recordApproval: (input: RecordApprovalInput) => void;
  /** Records the key a poll claimed, which no later poll can claim again. */
  readonly recordClaim: (input: RecordClaimInput) => void;
};

/** What the directory's store does with keys. */
export type KeyRecords = {
  readonly issueKey: (input: IssueKeyInput) => void;
  /** The key with the token's hash, none when the directory holds no such key. */
  readonly keyForToken: (input: KeyForTokenInput) => Option.Option<KeyRow>;
  /** A page of the principal's keys, oldest first, or a cursor that names no key of theirs. */
  readonly keysOfPrincipal: (input: KeysOfPrincipalInput) => KeyRowPage;
  /** The token's hash of the principal's key; none when the principal owns no such key. */
  readonly keyTokenHash: (input: OwnedKeyInput) => Option.Option<string>;
  /** Revokes the principal's key, keeping an earlier revocation time; none when the principal owns no such key. */
  readonly revokeKey: (input: RevokeKeyInput) => Option.Option<KeyRow>;
};

/** The personal workspace a principal's sign-up creates. */
type PersonalWorkspace = {
  readonly id: typeof WorkspaceId.Encoded;
  readonly name: string;
  readonly dailyAllowanceMicros: typeof Micros.Encoded;
};

/** A verified provider subject can resolve to an existing principal before sign-up. */
export type PrincipalForIdentityInput = { readonly identity: IdentityKey };

/** What the directory's store does with principals, their identities and their workspaces. */
export type PrincipalRecords = {
  readonly principal: (input: PrincipalInput) => PrincipalRow;
  /** The stable provider subjects whose admission policy applies to this principal. */
  readonly principalIdentities: (input: PrincipalInput) => ReadonlyArray<IdentityKey>;
  /** The principal that signed up with the identity, none before its first sign-in. */
  readonly principalForIdentity: (input: PrincipalForIdentityInput) => Option.Option<PrincipalRow>;
  /** Creates a principal, its identity, and its personal workspace with the principal as owner. */
  readonly signUp: (input: SignUpInput) => void;
  /** The personal workspace first, followed by shared workspaces in creation order. */
  readonly workspacesOfPrincipal: (input: PrincipalInput) => Array.NonEmptyReadonlyArray<WorkspaceRow>;
  /** Absent when the principal has no current membership in the workspace. */
  readonly workspaceMembership: (input: WorkspaceMembershipInput) => Option.Option<MembershipRole>;
  /** The model spend the workspace may make each UTC day, in micro-dollars. */
  readonly dailyAllowanceMicros: (input: WorkspaceInput) => typeof Micros.Encoded;
};

export type SignUpInput = {
  readonly principal: PrincipalRow;
  readonly identity: IdentityKey;
  readonly workspace: PersonalWorkspace;
  readonly now: DateTime.Utc;
};

/** What the directory's store does with browser sessions. */
export type BrowserSessionRecords = {
  /** Stores a new browser session, after forgetting every session that expired before it was created. */
  readonly openBrowserSession: (input: OpenBrowserSessionInput) => void;
  /** The unexpired session with the token's hash, none once it expired or when none opened. */
  readonly liveBrowserSession: (input: LiveBrowserSessionInput) => Option.Option<BrowserIdentity>;
};

export type ClaimSignInInput = { readonly stateHash: string; readonly now: DateTime.Utc };

export type ClaimableDeviceApprovalInput = { readonly pollTokenHash: string; readonly now: DateTime.Utc };

/** The directory database's functions; the store is the only code that runs SQL against the directory object. */
export type DirectoryStore = DatabaseFunctions &
  WorkspaceRecords &
  DeviceApprovalRecords &
  KeyRecords &
  PrincipalRecords &
  BrowserSessionRecords &
  SignInRecords;

export type IssueKeyInput = { readonly key: HashedKey };

export type KeyForTokenInput = { readonly tokenHash: string };

/** A page of the principal's keys, after the key a reader has last, or from the first. */
export type KeysOfPrincipalInput = PrincipalInput & PageAfterInput;

/** A record's creation and expiry times, which the directory sets by its own clock. */
export type Lifespan = { readonly createdAt: DateTime.Utc; readonly expiresAt: DateTime.Utc };

export type LiveBrowserSessionInput = { readonly tokenHash: string; readonly now: DateTime.Utc };

/** A key to store: its record, and the hash of its token. */
type HashedKey = KeyRow & {
  /** The SHA-256 hash of the key's token, the only form in which the directory stores a token. */
  readonly tokenHash: string;
};

export type OpenBrowserSessionInput = { readonly session: BrowserSessionRequest & Lifespan };

export type OpenDeviceApprovalInput = { readonly approval: DeviceApprovalRequest & Lifespan };

export type OpenSignInInput = { readonly signIn: StateHashInput & Lifespan };

/** A key by its id, as the principal that owns it names it. */
export type OwnedKeyInput = { readonly principalId: string; readonly keyId: string };

export type PendingDeviceApprovalInput = { readonly userCode: string; readonly now: DateTime.Utc };

export type RecordApprovalInput = { readonly approvalId: string; readonly principalId: string };

export type RecordClaimInput = { readonly approvalId: string; readonly keyId: string };

export type RevokeKeyInput = { readonly principalId: string; readonly keyId: string; readonly now: DateTime.Utc };

/** What the directory's store does with sign-ins. */
export type SignInRecords = {
  /** Stores a sign-in that GitHub will return to, after forgetting every sign-in that expired before it began. */
  readonly openSignIn: (input: OpenSignInInput) => void;
  /** Removes the unexpired sign-in with the state's hash, so one GitHub answer completes it once; else none. */
  readonly claimSignIn: (input: ClaimSignInInput) => Option.Option<ClaimedSignInRow>;
};
