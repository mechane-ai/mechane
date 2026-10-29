/** The events the Worker and its objects log, one JSON line each. */
export const LogEvent = {
  RequestFailed: 'request.failed',
  RequestLimited: 'request.limited',
  HarnessReport: 'harness.report',
  ObjectReset: 'object.reset',
  AlarmHandedOff: 'alarm.handed_off',
  DispatchRefused: 'dispatch.refused',
  SandboxRefused: 'sandbox.refused',
  EgressRefused: 'egress.refused',
  SignedUp: 'auth.signed_up',
  IdentitySignedUp: 'auth.identity_signed_up',
  KeyIssued: 'auth.key_issued',
  KeyRevoked: 'auth.key_revoked',
  WorkspaceCreated: 'workspace.created',
  WorkspaceMemberSet: 'workspace.member_set',
  WorkspaceMemberRemoved: 'workspace.member_removed',
} as const;

export type LogEvent = (typeof LogEvent)[keyof typeof LogEvent];

/** A code a line may carry: lowercase words joined by underscores and dots, which no free text or token matches. */
export const LOG_CODE_PATTERN = /^[a-z][a-z0-9_.]*$/;
