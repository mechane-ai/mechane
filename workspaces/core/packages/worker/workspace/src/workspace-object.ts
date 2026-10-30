import { EncryptedCredential } from '@mechane/deployment';
import {
  catalog,
  ConnectionConfiguration,
  ConnectionList,
  CredentialList,
  IntegrationSecretReference,
  SlackBinding,
  SlackBindingResult,
  SlackBindings,
  SlackInstallation,
  SlackInstallationResult,
  SlackInstallations,
  ToolGrant,
  ToolGrantList,
  WorkerMisconfigured,
  WorkspacePolicy,
} from '@mechane/protocol';
import type { DispatchRow } from '@mechane/protocol';
import { ConnectionId, MechId } from '@mechane/records';
import type { WorkDispatchesInput } from '@mechane/records';
import type {
  AdmitSlackEventInput,
  CommittedToday,
  ConfigureSlackBindingInput,
  ConfigureSlackInstallationInput,
  ConnectionIdInput,
  CredentialReferenceInput,
  DispatchSettlement,
  GrantToolsInput,
  IndexMechInput,
  LeaseDecision,
  LeaseMachineInput,
  MechConnectionInput,
  MechIdInput,
  MechsInput,
  PrepareMechCreationInput,
  ReadWorkspacePolicyInput,
  ReleaseMachineInput,
  ReservationDecision,
  ReserveDispatchInput,
  SaveConnectionInput,
  SaveCredentialInput,
  SaveWorkspacePolicyInput,
  SlackBindingInput,
  SlackInstallationInput,
  WorkspaceRpc,
} from '@mechane/rpc';
import {
  ConnectionMutation,
  CredentialMutation,
  CredentialReading,
  GrantedConnectionReading,
  GrantedConnections,
  MechCreationAnswer,
  MechSummaryPage,
  MechSummaryRecord,
  SlackBindingAnswer,
  SlackEventAdmission,
  SlackInstallationAnswer,
  ToolGrantMutation,
  WorkspacePolicyMutation,
  WorkspaceVariables,
} from '@mechane/rpc';
import { openWorkspaceStore } from '@mechane/workspace-store';
import type { WorkspaceStore } from '@mechane/workspace-store';
import { DurableObject } from 'cloudflare:workers';
import { DateTime, Duration, Option, Result, Schema } from 'effect';
import { grantTools } from './connections/grant-tools.ts';
import { grantedConnections } from './connections/granted-connections.ts';
import { saveConnection } from './connections/save-connection.ts';
import { saveCredential } from './credentials/save-credential.ts';
import { decideReservation } from './dispatches/decide-reservation.ts';
import { decideLease } from './leases/decide-lease.ts';
import { effectivePolicy } from './policy/effective-policy.ts';
import { savePolicy } from './policy/save-policy.ts';
import { admitSlackEvent } from './slack/admit-slack-event.ts';

/**
 * One workspace: the index of its mechs, the ledger of their dispatches and the leases of the machines its sandboxes
 * run. The ledger decides each dispatch against its workspace's allowance and its mech's cap. The Worker and the
 * workspace's mechs call its methods by RPC; each decides and writes synchronously, so no other call interleaves with
 * it, and answers with plain data.
 */
export class WorkspaceObject extends DurableObject<unknown> implements WorkspaceRpc {
  readonly #store: WorkspaceStore;
  readonly #settings: WorkspaceVariables;

  constructor(state: DurableObjectState, environment: unknown) {
    super(state, environment);

    const decoded = Schema.decodeUnknownResult(WorkspaceVariables)(environment);

    const checked = Result.mapError(
      decoded,
      () => new WorkerMisconfigured({ reason: 'workspace settings are invalid' }),
    );

    this.#settings = Result.getOrThrow(checked);
    this.#store = openWorkspaceStore({ storage: state.storage });
  }

  policy({ initialAllowanceMicros }: ReadWorkspacePolicyInput): typeof WorkspacePolicy.Encoded {
    const policy = effectivePolicy({ store: this.#store, settings: this.#settings, initialAllowanceMicros });

    return Schema.encodeSync(WorkspacePolicy)(policy);
  }

  savePolicy({ policy, isCreateOnly }: SaveWorkspacePolicyInput): typeof WorkspacePolicyMutation.Encoded {
    const decoded = Schema.decodeUnknownSync(WorkspacePolicy)(policy);
    const result = savePolicy({ store: this.#store, settings: this.#settings, policy: decoded, isCreateOnly });

    return Schema.encodeSync(WorkspacePolicyMutation)(result);
  }

  /** The count of schema migrations the workspace's database has applied. */
  schemaRevision(): number {
    return this.#store.schemaRevision();
  }

  configureSlackInstallation({
    installation,
    isCreateOnly,
  }: ConfigureSlackInstallationInput): typeof SlackInstallationResult.Encoded {
    const decoded = Schema.decodeUnknownSync(SlackInstallation)(installation);
    const answer = this.#store.saveSlackInstallation({ installation: decoded, isCreateOnly });

    return Schema.encodeSync(SlackInstallationResult)(answer);
  }

  slackInstallations(): typeof SlackInstallations.Encoded {
    const installations = this.#store.slackInstallations();

    return Schema.encodeSync(SlackInstallations)({ installations });
  }

  slackInstallation({ connectionId }: SlackInstallationInput): typeof SlackInstallationAnswer.Encoded {
    const installation = this.#store.slackInstallation({ connectionId });

    return Schema.encodeSync(SlackInstallationAnswer)(installation);
  }

  deleteSlackInstallation({ connectionId }: SlackInstallationInput): void {
    this.#store.deleteSlackInstallation({ connectionId });
  }

  credential({ secretReference }: CredentialReferenceInput): typeof CredentialReading.Encoded {
    const reference = Schema.decodeUnknownSync(IntegrationSecretReference)(secretReference);
    const credential = this.#store.credential({ secretReference: reference });

    return Schema.encodeSync(CredentialReading)(credential);
  }

  credentials(): typeof CredentialList.Encoded {
    const credentials = this.#store.credentials();

    return Schema.encodeSync(CredentialList)({ credentials });
  }

  saveCredential({
    secretReference,
    credential,
    isCreateOnly,
  }: SaveCredentialInput): typeof CredentialMutation.Encoded {
    const reference = Schema.decodeUnknownSync(IntegrationSecretReference)(secretReference);
    const encrypted = Schema.decodeUnknownSync(EncryptedCredential)(credential);

    const result = saveCredential({
      store: this.#store,
      secretReference: reference,
      credential: encrypted,
      isCreateOnly,
    });

    return Schema.encodeSync(CredentialMutation)(result);
  }

  deleteCredential({ secretReference }: CredentialReferenceInput): void {
    const reference = Schema.decodeUnknownSync(IntegrationSecretReference)(secretReference);

    this.#store.deleteCredential({ secretReference: reference });
  }

  configureSlackBinding({ binding }: ConfigureSlackBindingInput): typeof SlackBindingResult.Encoded {
    const decoded = Schema.decodeUnknownSync(SlackBinding)(binding);
    const answer = this.#store.configureSlackBinding({ binding: decoded });

    return Schema.encodeSync(SlackBindingResult)(answer);
  }

  slackBindings(): typeof SlackBindings.Encoded {
    const bindings = this.#store.slackBindings();

    return Schema.encodeSync(SlackBindings)({ bindings });
  }

  slackBinding({ bindingId }: SlackBindingInput): typeof SlackBindingAnswer.Encoded {
    const binding = this.#store.slackBinding({ bindingId });

    return Schema.encodeSync(SlackBindingAnswer)(binding);
  }

  admitSlackEvent({ ...input }: AdmitSlackEventInput): typeof SlackEventAdmission.Encoded {
    const answer = admitSlackEvent({ store: this.#store, ...input });

    return Schema.encodeSync(SlackEventAdmission)(answer);
  }

  indexMech({ mech }: IndexMechInput): void {
    this.#store.indexMech({ mech: Schema.decodeUnknownSync(MechSummaryRecord)(mech) });
  }

  prepareMechCreation({ requestId, fingerprint, seed }: PrepareMechCreationInput): typeof MechCreationAnswer.Encoded {
    const intent = this.#store.prepareMechCreation({ requestId, fingerprint, seed });

    if (intent.fingerprint !== fingerprint) {
      const conflict = MechCreationAnswer.cases.Conflicting.make({});

      return Schema.encodeSync(MechCreationAnswer)(conflict);
    }

    const prepared = Schema.decodeUnknownSync(MechCreationAnswer.cases.Prepared.fields.seed)(intent.seed);
    const answer = MechCreationAnswer.cases.Prepared.make({ seed: prepared });

    return Schema.encodeSync(MechCreationAnswer)(answer);
  }

  /** A page of the workspace's mechs after the query's cursor. */
  mechs({ query }: MechsInput): typeof MechSummaryPage.Encoded {
    const { after } = Schema.decodeUnknownSync(catalog.listMechs.query)(query);

    return Schema.encodeSync(MechSummaryPage)(this.#store.mechs({ after }));
  }

  saveConnection({ ...input }: SaveConnectionInput): typeof ConnectionMutation.Encoded {
    const configuration = Schema.decodeUnknownSync(ConnectionConfiguration)(input.configuration);
    const connectionId = ConnectionId.make(input.connectionId);
    const result = saveConnection({ store: this.#store, ...input, connectionId, configuration });

    return Schema.encodeSync(ConnectionMutation)(result);
  }

  connections(): typeof ConnectionList.Encoded {
    const connections = this.#store.listConnections();

    return Schema.encodeSync(ConnectionList)({ connections });
  }

  deleteConnection({ ...input }: ConnectionIdInput): void {
    const connectionId = ConnectionId.make(input.connectionId);

    this.#store.deleteConnection({ connectionId });
  }

  grantTools({ ...input }: GrantToolsInput): typeof ToolGrantMutation.Encoded {
    const grantValue = Schema.toType(ToolGrant);
    const grant = Schema.decodeUnknownSync(grantValue)(input);
    const result = grantTools({ store: this.#store, grant });

    return Schema.encodeSync(ToolGrantMutation)(result);
  }

  revokeTools({ ...input }: MechConnectionInput): typeof ToolGrant.Encoded {
    const grantValue = Schema.toType(ToolGrant);
    const grant = Schema.decodeUnknownSync(grantValue)({ ...input, tools: [] });

    this.#store.revokeTools(grant);

    return Schema.encodeSync(ToolGrant)(grant);
  }

  toolGrants({ mechId }: MechIdInput): typeof ToolGrantList.Encoded {
    const mech = MechId.make(mechId);
    const grants = this.#store.listToolGrants({ mechId: mech });

    return Schema.encodeSync(ToolGrantList)({ grants });
  }

  grantedConnections({ mechId }: MechIdInput): typeof GrantedConnections.Encoded {
    const mech = MechId.make(mechId);
    const grants = grantedConnections({ store: this.#store, mechId: mech });

    return Schema.encodeSync(GrantedConnections)(grants);
  }

  grantedConnection({ mechId, connectionId }: MechConnectionInput): typeof GrantedConnectionReading.Encoded {
    const mech = MechId.make(mechId);
    const connections = grantedConnections({ store: this.#store, mechId: mech });
    const found = connections.find((candidate) => candidate.connection.id === connectionId);
    const granted = Option.fromUndefinedOr(found);

    return Schema.encodeSync(GrantedConnectionReading)(granted);
  }

  reserveDispatch({ dispatch, allowanceMicros, capMicros }: ReserveDispatchInput): typeof ReservationDecision.Encoded {
    return decideReservation({
      store: this.#store,
      settings: this.#settings,
      dispatch,
      allowanceMicros,
      capMicros,
      now: DateTime.nowUnsafe(),
    });
  }

  settleDispatch({ dispatchId, settlement }: DispatchSettlement): void {
    this.#store.settleDispatch({ dispatchId, settlement, now: DateTime.nowUnsafe() });
  }

  /** Settles the mech's open reservations, which a lost instance of the mech left, before it dispatches again. */
  settleOpenDispatches({ mechId }: MechIdInput): void {
    this.#store.settleOpenDispatches({ mechId, now: DateTime.nowUnsafe() });
  }

  /** What the current UTC day's dispatches have committed of the workspace's allowance, settled and reserved. */
  committedToday(): typeof CommittedToday.Encoded {
    const day = DateTime.formatIsoDateUtc(DateTime.nowUnsafe());

    return { day, committedMicros: this.#store.dayCommittedMicros({ day }) };
  }

  /** Leases a machine to the sandbox for its idle window, while the workspace runs fewer than it may. */
  leaseMachine({ sandboxId, leaseMs }: LeaseMachineInput): typeof LeaseDecision.Encoded {
    const now = DateTime.nowUnsafe();
    const expiresAt = DateTime.addDuration(now, Duration.millis(leaseMs));

    return decideLease({ store: this.#store, settings: this.#settings, sandboxId, expiresAt, now });
  }

  /** Releases a sandbox's lease once its machine stopped, such as an ended drone's. */
  releaseMachine({ sandboxId }: ReleaseMachineInput): void {
    this.#store.releaseLease({ sandboxId });
  }

  /** The dispatches of a turn or a drone as the ledger holds them, which the Worker decodes by status and basis. */
  workDispatches({ mechId, workId }: WorkDispatchesInput): ReadonlyArray<DispatchRow> {
    return this.#store.workDispatches({ mechId, workId });
  }
}
