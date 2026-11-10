import type { OperationName } from '@mechane/protocol';
import type { AuthCaller } from '@mechane/runtime';

export type ProtocolRequest = {
  readonly name: OperationName;
  readonly input: object;
  readonly caller: AuthCaller;
  /** Absent requests the full media; only the Range header crosses into operation handling. */
  readonly mediaRange?: string;
};

export type ProtocolExecutor = (request: ProtocolRequest) => Promise<unknown>;
export type RequestAuthenticator = (request: Request, peerAddress?: string | null) => Promise<AuthCaller>;
export type PublicRequestLimiter = (name: OperationName, peerAddress?: string | null) => Promise<void>;

export type MembershipAuthorizer = (input: {
  readonly caller: AuthCaller;
  readonly workspaceId: string;
}) => Promise<unknown>;

export type ProtocolHandlerOptions = {
  readonly execute: ProtocolExecutor;
  readonly authenticate: RequestAuthenticator;
  readonly authenticateSelf: RequestAuthenticator;
  readonly authorizeMembership: MembershipAuthorizer;
  readonly limitPublicRequest: PublicRequestLimiter;
};

export type RouteMatch = { readonly name: OperationName; readonly params: Readonly<Record<string, string>> };
