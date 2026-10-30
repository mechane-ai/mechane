import type { DispatchRow, DispatchStatus, Settlement } from '@mechane/protocol';
import type { CreationRequestId, DispatchRequest, WorkDispatchesInput } from '@mechane/records';
import type { DatabaseFunctions, PageAfterInput } from '@mechane/store';
import type { DateTime, Option } from 'effect';
import type { ConnectionRecords } from './connections/connection-records.ts';
import type { CredentialRecords } from './credentials/credential-records.ts';
import type { policyRecords } from './policy/policy-records.ts';
import type { CommittedRow, LeaseRow, MechRowPage, MechSummaryRow } from './schemas.ts';
import type { SlackInstallationRecords } from './slack-installations/slack-installation-records.ts';
import type { slackRecords } from './slack/slack-records.ts';

type SlackRecords = Readonly<ReturnType<typeof slackRecords>>;

/** What the workspace's store does with its ledger of dispatches. */
export type DispatchRecords = {
  /**
   * What the day's settled dispatches cost and its open reservations hold together, in micro-dollars: for the whole
   * workspace, and for the mech alone.
   */
  readonly committedMicros: (input: CommittedInput) => CommittedRow;
  /** What the day's settled dispatches cost and its open reservations hold together in the whole workspace. */
  readonly dayCommittedMicros: (input: DayInput) => number;
  readonly recordDispatch: (input: RecordDispatchInput) => void;
  /** Settles a reserved dispatch once; a dispatch already settled, or refused, stays as it is. */
  readonly settleDispatch: (input: SettleDispatchInput) => void;
  /** Settles each of the mech's reserved dispatches at its reservation, since none of their outcomes is known. */
  readonly settleOpenDispatches: (input: SettleOpenDispatchesInput) => void;
  /** The dispatches of one turn or drone of a mech, in the order they were decided. */
  readonly workDispatches: (input: WorkDispatchesInput) => ReadonlyArray<DispatchRow>;
};

/** A mech its object created, to add to the workspace's index. */
export type IndexMechInput = { readonly mech: MechSummaryRow };

/** What the workspace's store does with its index of mechs. */
export type MechIndexRecords = {
  /** Adds a mech its object created to the workspace's index. */
  readonly indexMech: (input: IndexMechInput) => void;
  /** A page of the workspace's mechs, oldest first, or a cursor that names no mech of its own. */
  readonly mechs: (input: PageAfterInput) => MechRowPage;
  /** Keeps the first seed under a request ID so callers can compare fingerprints before reusing its identity. */
  readonly prepareMechCreation: (input: PrepareMechCreationInput) => CreationIntent;
};

export type PrepareMechCreationInput = {
  readonly requestId: CreationRequestId;
  readonly fingerprint: string;
  readonly seed: string;
};

/** The first serialized creation seed and request fingerprint retained for all retries under one request ID. */
export type CreationIntent = { readonly fingerprint: string; readonly seed: string };

/** A UTC day as the ledger names it, such as `2026-10-23`, and the mech whose own share of it to count too. */
export type CommittedInput = { readonly day: string; readonly mechId: string };

/** A UTC day as the ledger names it. */
export type DayInput = { readonly day: string };

/** A dispatch the ledger decided. */
type DecidedDispatch = DispatchRequest & {
  readonly day: string;
  readonly status: DispatchStatus;
  readonly decidedAt: DateTime.Utc;
};

export type HoldLeaseInput = { readonly sandboxId: string; readonly expiresAt: DateTime.Utc };

/** The lease of one sandbox, by its mech's id for the mech's own and its drone's id for a drone's. */
export type LeaseInput = { readonly sandboxId: string };

/** What the workspace's store does with its machines' leases. */
export type MachineLeaseRecords = {
  /** Forgets every lease whose machine has been idle past its window, which a lost release leaves. */
  readonly dropExpiredLeases: (input: NowInput) => void;
  /** The sandbox's lease, none when it holds none. */
  readonly sandboxLease: (input: LeaseInput) => Option.Option<LeaseRow>;
  readonly leaseCount: () => number;
  /** Holds the sandbox's lease until `expiresAt`, renewing one it holds. */
  readonly holdLease: (input: HoldLeaseInput) => void;
  readonly releaseLease: (input: LeaseInput) => void;
};

/** The instant of the call that reads or writes. */
export type NowInput = { readonly now: DateTime.Utc };

export type RecordDispatchInput = { readonly dispatch: DecidedDispatch };

export type SettleDispatchInput = {
  readonly dispatchId: string;
  readonly settlement: Settlement;
  readonly now: DateTime.Utc;
};

export type SettleOpenDispatchesInput = { readonly mechId: string; readonly now: DateTime.Utc };

/** The workspace database's functions; the store is the only code that runs SQL against the workspace object. */
export type WorkspaceStore = ConnectionRecords &
  Readonly<ReturnType<typeof policyRecords>> &
  CredentialRecords &
  DatabaseFunctions &
  MechIndexRecords &
  DispatchRecords &
  MachineLeaseRecords &
  SlackRecords &
  SlackInstallationRecords;
