export { catalog } from './catalog.ts';
export { findRoute } from './find-route.ts';
export type { RouteMatch } from './find-route.ts';
export { CredentialAlreadyExists } from './errors/credential.errors.ts';
export {
  CredentialValue,
  CredentialMetadata,
  CredentialList,
  CredentialDeletion,
} from './operations/credentials/schemas.ts';
export type { OperationName } from './catalog.ts';
export { RELEASE } from './release.ts';
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
  MechNotFound,
  RateLimited,
  RequestConflict,
  RequestInvalid,
  RouteNotFound,
  ServiceUnavailable,
  WorkspaceNotFound,
} from './errors/errors.ts';
/**
 * Standalone @mechane/client declarations name these classes in the public operation failure union.
 *
 * @public
 */
export { MechBusy, ServerMisconfigured, ReleaseFileNotFound, WorkspaceSuspended } from './errors/errors.ts';
/**
 * Standalone @mechane/client callers can distinguish archived mechs and exhausted sandbox capacity from transport
 * failure.
 *
 * @public
 */
export { MechArchived, SandboxCapacityReached } from './errors/mech.errors.ts';
/**
 * Standalone @mechane/client callers can inspect a failed artifact read without receiving its upstream body.
 *
 * @public
 */
export { ReleaseSourceUnavailable } from './errors/release-source.errors.ts';
export { TurnNotFound } from './errors/mech.errors.ts';
export { MechCreationConflict, MechRevisionConflict, SandboxDisabled } from './errors/mech.errors.ts';

export type { FailureCodec } from './errors/types.ts';

export { RELEASE_REPOSITORY, ReleaseAsset } from './releases/constants.ts';
export { releaseBinaryName } from './releases/release-binary-name.ts';
export { releaseAssetUrl } from './releases/release-asset-url.ts';
export { LogEventCursor } from './operations/events/list-events.ts';
export { Event, EventPage, ListedEvent, UnknownEvent } from './operations/events/schemas.ts';
export { EventType } from './operations/events/constants.ts';
export { NotificationText, NOTIFICATION_TEXT_MAX_CHARS } from './operations/notifications/schemas.ts';
export { ConsoleMessage, ConsoleMessagePage } from './operations/conversation/schemas.ts';
export { Instructions, Mech, MechList, MechPage, MechSummary, NativeToolName } from './operations/mechs/schemas.ts';
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
export { ConsoleView, DeviceStep, TYPED_CODE_FIELD } from './pages/constants.ts';

export { Release, ReleaseManifest, ReleaseStamp } from './releases/schemas.ts';
export { CliTarget, INSTALL_FOLDER_VARIABLE, INSTALL_SCRIPT_PATH, ReleaseKey } from './releases/constants.ts';
export { installScriptUrl } from './releases/install-script-url.ts';
export { latestReleaseUrl } from './releases/latest-release-url.ts';
export { releaseBinaryKey } from './releases/release-binary-key.ts';
export { releaseManifestKey } from './releases/release-manifest-key.ts';
export { Readiness } from './operations/status/schemas.ts';
export { SERVICE } from './operations/status/constants.ts';
export {
  Dispatch,
  REPLY_EXCERPT_MAX_CHARS,
  TurnToolCall,
  Trace,
  TracedDispatch,
  Turn,
  UnknownDispatch,
  UnknownTurn,
} from './operations/turns/schemas.ts';
export {
  BashExecutionStatus,
  DispatchStatus,
  SettlementBasis,
  ToolCallStatus,
  ToolInspectionKind,
  TOOL_TRACE_COMMAND_MAX_BYTES,
  TOOL_TRACE_OUTPUT_MAX_BYTES,
  TOOL_TRACE_MAX_BYTES,
  TurnRuntimeSource,
  TurnStatus,
} from './operations/turns/constants.ts';
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

export { SandboxAction, SandboxPhase, SandboxRequest, SandboxReport } from '@mechane/sandbox-wire';
export { SandboxRestoreRequest, SandboxRestoreResult } from '@mechane/sandbox-wire';

export {
  WorkspaceOwnerRequired,
  ConnectionNotFound,
  ConnectionLimitReached,
  ToolGrantInvalid,
} from './errors/errors.ts';
export {
  ConnectionConfiguration,
  RemoteConnection,
  ConnectionList,
  ConnectionDeletion,
  ToolGrant,
  ToolGrantList,
  RemoteToolNames,
  RemoteMcpUrl,
  IntegrationSecretReference,
} from './operations/connections/schemas.ts';
export { RemoteToolPolicy, CONNECTIONS_PER_WORKSPACE } from './operations/connections/constants.ts';

export { ServerFailure } from './errors/server-failure.errors.ts';
export { WorkspacePolicy } from './operations/workspaces/policy.schemas.ts';

export { TurnPage } from './operations/turns/list-turns.ts';
export { ExecutionAccess, ExecutionAccessState } from './operations/execution-access/schemas.ts';

export { EvidenceNotFound, EvidenceUnavailable } from './errors/evidence.errors.ts';
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
  EvidenceMediaType,
  EvidencePage,
  EvidencePath,
  EvidenceQuery,
  EvidenceSha256,
} from './operations/evidence/schemas.ts';
export {
  EvidenceKind,
  EvidenceStatus,
  EVIDENCE_ARTIFACT_MAX_BYTES,
  EVIDENCE_MECH_MAX_BYTES,
  EVIDENCE_MECH_MAX_ARTIFACTS,
  EVIDENCE_PAGE_ARTIFACTS,
} from './operations/evidence/constants.ts';
export {
  evidenceContentPath,
  evidenceViewerPath,
  readEvidenceViewerPath,
} from './operations/evidence/evidence-paths.ts';
export { signInPath } from './pages/sign-in-path.ts';
export { BrowserAuthenticationPath, BROWSER_AUTHENTICATION_REQUEST } from './pages/browser-authentication.ts';

export { BYTES_PER_MEBIBYTE as EVIDENCE_CHUNK_MAX_BYTES } from '@mechane/records';
export { BrowserEvidenceProgress } from './operations/evidence/browser-evidence-progress.ts';

export {
  sandboxEvidenceListPath,
  sandboxEvidenceArtifactPath,
  sandboxEvidenceContentPath,
} from './operations/evidence/evidence-service-paths.ts';

export { ProcessHandle, ProcessObservation, ProcessSummary, ProcessSummaries } from '@mechane/sandbox-wire';

export { SELF_TOKEN_VARIABLE } from './operations/self/schemas.ts';
export { Routine, RoutineId, RoutineList } from './operations/routines/schemas.ts';

export {
  MECH_HISTORY_IMPORT_PATH,
  MECH_HISTORY_IMPORT_BATCH_MAX_BYTES,
  MECH_HISTORY_IMPORT_BODY_MAX_BYTES,
  MechHistorySourceKind,
  MechHistoryImportBatch,
  MechHistoryImport,
  MechHistoryImportReceipt,
  SourceCompletion,
} from './import/schemas.ts';

export {
  SANDBOX_OWNERS_PATH,
  SandboxOwnerQuery,
  SandboxOwnerPage,
} from './operations/environment/sandbox-owner.schemas.ts';

export { HeldWorkPage } from './operations/history/list-held-work.ts';
export type { HeldWorkItem } from './operations/history/list-held-work.ts';

export {
  MECH_MAINTENANCE_PATH,
  MechMaintenanceAction,
  MechRuntimeStatus,
  MechMaintenanceRequest,
  MechMaintenanceReceipt,
} from './operations/mechs/maintenance.schemas.ts';

export { StartupFailure, StartupPhase, StartupProgress, NativeSnapshotReport } from '@mechane/sandbox-wire';

export { managedRequestDefinitions, managedOperations, matchManagedRoute } from './managed/requests.ts';
export type { ManagedHttpRoute } from './managed/requests.ts';
export {
  canForwardManagedWorkerRequest,
  hasManagedWorkCredential,
  managedWorkerAccess,
} from './managed/worker-access.ts';

export { managedWorkspaceId } from './managed/workspace-id.ts';
