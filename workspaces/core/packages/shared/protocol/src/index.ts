export { catalog } from './catalog.ts';
export { findRoute } from './find-route.ts';
export type { RouteMatch } from './find-route.ts';
export { CredentialAlreadyExists } from './errors/credential.errors.ts';
export {
  CredentialValue,
  CredentialMetadata,
  CredentialList,
  CredentialDeletion,
  IntegrationSecretReference,
} from './operations/credentials/schemas.ts';
export type { OperationName } from './catalog.ts';
export {
  ApprovedPoll,
  DeviceApproval,
  DeviceApprovalPoll,
  KeyList,
  KeyMetadata,
  KeyName,
  KeyToken,
  Principal,
  UserCode,
} from './operations/auth/schemas.ts';
export {
  KeyPurpose,
  PollStatus,
  TOKEN_RANDOM_BYTES,
  TokenPrefix,
  USER_CODE_ALPHABET,
  USER_CODE_GROUP_CHARS,
  USER_CODE_GROUPS,
} from './operations/auth/constants.ts';
export { userCodeOf } from './operations/auth/user-code-of.ts';
export { bearerAuthorization } from './operations/auth/bearer-authorization.ts';
export { detailFailure } from './errors/detail-failure.ts';
export { ErrorBody } from './errors/schemas.ts';
export { errorDetail } from './errors/error-detail.ts';
export { ErrorFamily, FAMILY_STATUS } from './errors/constants.ts';
export { FAILURE_FAMILY } from './errors/failure-family.ts';
export { RELEASE_FAILURES } from './errors/release-failures.ts';
export { ROUTE_FAILURES } from './errors/route-failures.ts';
export {
  UnknownFailure,
  KeyMissing,
  DeviceApprovalNotFound,
  KeyExpired,
  KeyUnrecognized,
  KeyNotFound,
  KeyRevoked,
  RateLimited,
  RequestConflict,
  RequestInvalid,
  RouteNotFound,
  ServiceUnavailable,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from './errors/errors.ts';
/**
 * Standalone @mechane/client declarations name these classes in the public operation failure union.
 *
 * @public
 */
export {
  MechBusy,
  MechNotFound,
  ServerMisconfigured,
  ReleaseFileNotFound,
  WorkspaceSuspended,
  ConnectionNotFound,
  ConnectionLimitReached,
  ToolGrantInvalid,
} from './errors/errors.ts';
/**
 * Standalone @mechane/client callers can distinguish archived mechs and exhausted sandbox capacity from transport
 * failure.
 *
 * @public
 */
export {
  MechArchived,
  MechCreationConflict,
  MechRevisionConflict,
  SandboxCapacityReached,
  SandboxDisabled,
  TurnNotFound,
} from './errors/mech.errors.ts';
/**
 * Standalone @mechane/client callers can inspect a failed artifact read without receiving its upstream body.
 *
 * @public
 */
export { ReleaseSourceUnavailable } from './errors/release-source.errors.ts';

export type { FailureCodec } from './errors/types.ts';

export { Instructions, NotificationText, NOTIFICATION_TEXT_MAX_CHARS } from './operations/notifications/schemas.ts';
export { Access, ACCESS_FAILURES } from './operation/constants.ts';
export { ManagedAgentPolicy } from './operations/agents/agent-policy.ts';
export {
  RevokedWorkspaceServiceKey,
  ServiceSubject,
  WorkspaceServicePrincipal,
} from './operations/service-principals/schemas.ts';
export { decodeRequestPart } from './operation/decode-request-part.ts';
export { NoFields, OperationMethod } from './operation/schemas.ts';
export type { Operation, OperationInput, OperationOutput, ServiceFreeCodec } from './operation/types.ts';
export { GitHubTokenAnswer, GitHubUser } from './github/schemas.ts';

export { ApproveForm, DeviceForm } from './pages/schemas.ts';
export { DeviceStep, TYPED_CODE_FIELD } from './pages/constants.ts';

export { Readiness } from './operations/status/schemas.ts';
export { SERVICE } from './operations/status/constants.ts';
export {
  Allowance,
  Workspace,
  WorkspaceList,
  WorkspaceMember,
  WorkspaceMemberList,
  WorkspaceMemberRemoval,
} from './operations/workspaces/schemas.ts';
export {
  IdentityNotAdmitted,
  InstallationAdministratorRequired,
  PersonalWorkspaceProtected,
  PrincipalNotFound,
  WorkspaceCreationConflict,
  WorkspacePolicyConflict,
  WorkspaceLastOwner,
  WorkspaceMemberNotFound,
} from './errors/workspace.errors.ts';
export { MembershipRole } from './operations/workspaces/constants.ts';

export { ServerFailure } from './errors/server-failure.errors.ts';
export { WorkspacePolicy } from './operations/workspaces/policy.schemas.ts';

export { ExecutionAccess, ExecutionAccessState } from './operations/execution-access/schemas.ts';

export { EvidenceQuery, EvidenceStatus } from '@mechane/sandbox-wire';
export {
  ConsoleSessionEvidenceArtifact,
  ConsoleSessionEvidencePage,
} from './operations/evidence/console-session-evidence.ts';
export {
  consoleSessionEvidencePath,
  consoleSessionEvidenceViewerPath,
} from './operations/evidence/console-session-evidence-paths.ts';
export {
  EvidenceArtifact,
  EvidenceDescriptor,
  EvidencePage,
  EvidencePath,
  EvidenceSha256,
} from './operations/evidence/schemas.ts';
export {
  EvidenceKind,
  EVIDENCE_ARTIFACT_MAX_BYTES,
  EVIDENCE_MECH_MAX_BYTES,
  EVIDENCE_MECH_MAX_ARTIFACTS,
  EVIDENCE_PAGE_ARTIFACTS,
} from './operations/evidence/constants.ts';
export { signInPath } from './pages/sign-in-path.ts';
export { BrowserAuthenticationPath, BROWSER_AUTHENTICATION_REQUEST } from './pages/browser-authentication.ts';

export { BYTES_PER_MEBIBYTE as EVIDENCE_CHUNK_MAX_BYTES } from '@mechane/records';
export { BrowserEvidenceProgress } from './operations/evidence/browser-evidence-progress.ts';

export { sandboxEvidenceContentPath } from './operations/evidence/evidence-service-paths.ts';
