import type {
  catalog,
  ConnectionList,
  CredentialList,
  DispatchRow,
  ExecutionAccessChange,
  Settlement,
  SlackBindingResult,
  SlackBindings,
  SlackInstallationResult,
  SlackInstallations,
  ToolGrant,
  ToolGrantList,
  WorkspacePolicy,
} from '@mechane/protocol';
import type { CreationRequestId, DispatchRequest, MechId, WorkDispatchesInput } from '@mechane/records';
import type {
  ConnectionMutation,
  GrantedConnectionReading,
  GrantedConnections,
  ToolGrantMutation,
} from './connections.schemas.ts';
import type {
  ConnectionIdInput,
  GrantToolsInput,
  MechConnectionInput,
  SaveConnectionInput,
} from './connections.types.ts';
import type { CredentialMutation, CredentialReading } from './credentials.schemas.ts';
import type { CredentialReferenceInput, SaveCredentialInput } from './credentials.types.ts';
import type { ExecutionAccessReading } from './execution-access.schemas.ts';
import type { SlackBindingAnswer, SlackEventAdmission, SlackInstallationAnswer } from './slack.schemas.ts';
import type {
  AdmitSlackEventInput,
  ConfigureSlackBindingInput,
  ConfigureSlackInstallationInput,
  SlackBindingInput,
  SlackInstallationInput,
} from './slack.types.ts';
import type { WorkspacePolicyMutation } from './workspace-policy.schemas.ts';
import type { ReadWorkspacePolicyInput, SaveWorkspacePolicyInput } from './workspace-policy.types.ts';
import type {
  CommittedToday,
  LeaseDecision,
  MechCreationAnswer,
  MechSummaryPage,
  MechSummaryRecord,
  ReservationDecision,
} from './workspace.schemas.ts';

type CredentialMethods = {
  readonly credential: (input: CredentialReferenceInput) => typeof CredentialReading.Encoded;
  readonly credentials: () => typeof CredentialList.Encoded;
  readonly saveCredential: (input: SaveCredentialInput) => typeof CredentialMutation.Encoded;
  readonly deleteCredential: (input: CredentialReferenceInput) => void;
};

type MechGrantsInput = { readonly mechId: typeof MechId.Encoded };

type ConnectionMethods = {
  readonly saveConnection: (input: SaveConnectionInput) => typeof ConnectionMutation.Encoded;
  readonly connections: () => typeof ConnectionList.Encoded;
  readonly deleteConnection: (input: ConnectionIdInput) => void;
  readonly grantTools: (input: GrantToolsInput) => typeof ToolGrantMutation.Encoded;
  readonly revokeTools: (input: MechConnectionInput) => typeof ToolGrant.Encoded;
  readonly toolGrants: (input: MechGrantsInput) => typeof ToolGrantList.Encoded;
  readonly grantedConnections: (input: MechGrantsInput) => typeof GrantedConnections.Encoded;
  readonly grantedConnection: (input: MechConnectionInput) => typeof GrantedConnectionReading.Encoded;
};

/** Each RPC method of a workspace's object. */
type WorkspaceMethods = {
  readonly executionAccess: (input: MechIdInput) => typeof ExecutionAccessReading.Encoded;
  readonly configureExecutionAccess: (input: ConfigureExecutionAccessInput) => typeof ExecutionAccessReading.Encoded;
  readonly policy: (input: ReadWorkspacePolicyInput) => typeof WorkspacePolicy.Encoded;
  readonly savePolicy: (input: SaveWorkspacePolicyInput) => typeof WorkspacePolicyMutation.Encoded;
  readonly configureSlackInstallation: (
    input: ConfigureSlackInstallationInput,
  ) => typeof SlackInstallationResult.Encoded;
  readonly slackInstallations: () => typeof SlackInstallations.Encoded;
  readonly slackInstallation: (input: SlackInstallationInput) => typeof SlackInstallationAnswer.Encoded;
  readonly deleteSlackInstallation: (input: SlackInstallationInput) => void;
  readonly configureSlackBinding: (input: ConfigureSlackBindingInput) => typeof SlackBindingResult.Encoded;
  readonly slackBindings: () => typeof SlackBindings.Encoded;
  readonly slackBinding: (input: SlackBindingInput) => typeof SlackBindingAnswer.Encoded;
  readonly admitSlackEvent: (input: AdmitSlackEventInput) => typeof SlackEventAdmission.Encoded;
  /** The count of schema migrations the workspace's database has applied. */
  readonly schemaRevision: () => number;
  readonly indexMech: (input: IndexMechInput) => void;
  readonly prepareMechCreation: (input: PrepareMechCreationInput) => typeof MechCreationAnswer.Encoded;
  /** A page of the workspace's mechs after the query's cursor. */
  readonly mechs: (input: MechsInput) => typeof MechSummaryPage.Encoded;
  readonly reserveDispatch: (input: ReserveDispatchInput) => typeof ReservationDecision.Encoded;
  readonly settleDispatch: (input: DispatchSettlement) => void;
  /** Settles the mech's open reservations, which a lost instance of the mech left, before it dispatches again. */
  readonly settleOpenDispatches: (input: MechIdInput) => void;
  /** What the current UTC day's dispatches have committed of the workspace's allowance, settled and reserved. */
  readonly committedToday: () => typeof CommittedToday.Encoded;
  /** Reserves capacity until the sandbox confirms its machine stopped. Adoption accounts for an existing machine. */
  readonly reserveMachine: (input: ReserveMachineInput) => typeof LeaseDecision.Encoded;
  /** A matching reservation id prevents an old stop from releasing newer capacity. */
  readonly releaseMachine: (input: ReleaseMachineInput) => void;
  /** The dispatches of a turn or a drone as the ledger holds them, which the Worker decodes by status and basis. */
  readonly workDispatches: (input: WorkDispatchesInput) => ReadonlyArray<DispatchRow>;
};

/**
 * The methods a workspace's object serves by RPC, each answering with plain data its caller decodes. The bindings and
 * the mech name the object by this type, so they need not import the object.
 */
export type WorkspaceRpc = Rpc.DurableObjectBranded & WorkspaceMethods & ConnectionMethods & CredentialMethods;

/** A mech its object created, as the workspace's index takes it by RPC: its record, encoded. */
export type IndexMechInput = { readonly mech: typeof MechSummaryRecord.Encoded };

export type PrepareMechCreationInput = {
  readonly requestId: CreationRequestId;
  readonly fingerprint: string;
  readonly seed: string;
};

/** A dispatch's settlement, as its mech reports it once the dispatch ended. */
export type DispatchSettlement = { readonly dispatchId: string; readonly settlement: Settlement };

/** Adoption counts a machine that predates durable reservations, even if current policy would refuse a new one. */
export type ReserveMachineInput = ReleaseMachineInput & { readonly isAdopting: boolean };

export type MechIdInput = { readonly mechId: string };

export type ConfigureExecutionAccessInput = MechIdInput & {
  readonly configuration: typeof ExecutionAccessChange.Encoded;
};

/** A page of the workspace's mechs, as the Worker asks for it: the list's query as `/api/v1` encodes it. */
export type MechsInput = { readonly query: typeof catalog.listMechs.query.Encoded };

export type ReleaseMachineInput = { readonly sandboxId: string; readonly reservationId: number };

/**
 * A dispatch to reserve, the allowance its workspace has each UTC day, which the directory keeps, and its mech's own
 * cap each UTC day, which the mech keeps.
 */
export type ReserveDispatchInput = {
  readonly dispatch: DispatchRequest;
  readonly allowanceMicros: number;
  readonly capMicros: number;
};
