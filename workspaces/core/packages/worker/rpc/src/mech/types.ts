import type { catalog, Delivery, SlackDeliveries, TurnStatus, UnansweredReason } from '@mechane/protocol';
import type { CopyRows, DroneId, PrincipalId, TurnId } from '@mechane/records';
import type { DroneAnswer, DroneCancelAnswer, DronesAnswer, ThreadsAnswer } from '../drones.schemas.ts';
import type {
  EventsAnswer,
  ForkAnswer,
  ForkPointRecord,
  InboxItemReceipt,
  MechAnswer,
  MechRecord,
  MechRevisionsAnswer,
  MechUpdateAnswer,
  MemoriesAnswer,
  TurnCancelAnswer,
} from '../mech.schemas.ts';
import type { SandboxAnswer } from '../sandbox.schemas.ts';
import type { SandboxManageInput } from '../sandbox.types.ts';
import type { ReceiveSlackInboxItemInput } from '../slack.types.ts';
import type { SourceAnswer, SourceGrantAnswer } from '../source.schemas.ts';
import type { SourceManageInput } from '../source.types.ts';
import type { FindingsAnswer, WatchAnswer, WatchesAnswer } from '../watch.schemas.ts';
import type { SetWatchInput, UpdateWatchStatusInput, WatchInput } from '../watch.types.ts';

/** A member's cancel of a drone of the mech. */
export type CancelDroneInput = { readonly droneId: DroneId; readonly cancelerId: string };

/** A member's cancel of a turn of the mech. */
export type CancelTurnInput = { readonly turnId: TurnId; readonly cancelerId: string };

/**
 * A mech to create under the id and in the workspace the Worker chose, with the model it checked the deployment offers
 * and the daily cap it chose.
 */
export type CreateMechInput = {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly name: string;
  readonly model: string;
  /** The mech's instructions, null where its creator gave none. */
  readonly instructions: string | null;
  readonly creatorId: string;
  readonly dailyCapMicros: number;
};

export type UpdateMechInput = {
  readonly change: typeof catalog.updateMech.body.Encoded;
  readonly updaterId: typeof PrincipalId.Encoded;
};

export type MechRevisionsInput = { readonly after: number };

export type DroneInput = { readonly droneId: string };

/** A page of the mech's drones, as the Worker asks for it: the list's query as `/v1` encodes it. */
export type DronesInput = { readonly query: typeof catalog.listDrones.query.Encoded };

/** The events to list: those after `after`, waiting up to `waitMs` while there are none. */
export type EventsInput = { readonly after: number; readonly waitMs: number };

/** A fork to make: the new mech's id, which the Worker made, its name, and the member who asked for it. */
export type ForkInput = { readonly forkId: string; readonly name: string; readonly requesterId: string };

/** An inbox item to record and deliver as its sender chose, under the id its sender made. */
export type SendInboxItemInput = {
  readonly inboxItemId: string;
  readonly text: string;
  readonly delivery: Delivery;
  readonly senderId: string;
};

/** A page of the mech's threads, as the Worker asks for it: the list's query as `/v1` encodes it. */
export type ThreadsInput = { readonly query: typeof catalog.listThreads.query.Encoded };

export type TurnInput = { readonly turnId: string };

/** A turn as a mech's object answers it, decoded into the wire's turn; its end and reason are null until it ends. */
export type TurnFields = {
  readonly id: string;
  readonly status: TurnStatus;
  readonly inboxItemIds: ReadonlyArray<string>;
  readonly startedAtMs: number;
  readonly definitionRevision: number;
  /** When the turn ended, null while it runs. */
  readonly endedAtMs: number | null;
  /** Why the turn ended unanswered, null while it runs and for a turn that was answered. */
  readonly reason: UnansweredReason | null;
};

/** A turn read that found the turn. */
type FoundTurn = { readonly _tag: 'Found'; readonly turn: TurnFields };

/** A turn read of an object that holds no mech. */
type MissingMech = { readonly _tag: 'MechMissing' };

/** A turn read of a mech without a turn of the id. */
type MissingTurn = { readonly _tag: 'TurnMissing' };

/** What a turn read found. */
export type TurnReading = FoundTurn | MissingMech | MissingTurn;

/** The mech a fork's copy ends with: its record as its parent made it, in the parent's workspace, with its parent. */
export type ForkedMech = typeof MechRecord.Encoded & {
  readonly workspaceId: string;
  readonly forkedFrom: ForkPointRecord;
};

/** The first step of a copy: the object empties itself and marks the copy. */
type CopyBegin = { readonly _tag: 'Begin' };

/** A step that writes one page of a table's rows. */
type CopyPageStep = { readonly _tag: 'Rows'; readonly page: CopyRows<SqlStorageValue> };

/** The last step of a copy: the object creates the fork's mech and opens pi on what it received. */
type CopyEnd = { readonly _tag: 'End'; readonly mech: ForkedMech };

/** One step of a fork's copy, which the mech it copies sends the new mech's object in order. */
export type CopyStep = CopyBegin | CopyPageStep | CopyEnd;

export type CopyStepInput = { readonly step: CopyStep };

/**
 * The methods a mech's object serves by RPC, each answering with plain data the Worker decodes. The Worker's bindings
 * name the object by this type, so they need not import the object, which reads those bindings itself.
 */
export type MechRpc = Rpc.DurableObjectBranded & MechMethods;

/** Each RPC method of a mech's object. */
type MechMethods = {
  readonly manageSource: (input: SourceManageInput) => Promise<typeof SourceAnswer.Encoded>;
  readonly sourceGrant: () => Promise<typeof SourceGrantAnswer.Encoded>;
  readonly receiveSlackInboxItem: (input: ReceiveSlackInboxItemInput) => Promise<typeof InboxItemReceipt.Encoded>;
  readonly slackDeliveries: () => Promise<typeof SlackDeliveries.Encoded>;
  readonly setWatch: (input: SetWatchInput) => Promise<typeof WatchAnswer.Encoded>;
  readonly watchStatus: (input: UpdateWatchStatusInput) => Promise<typeof WatchAnswer.Encoded>;
  readonly watches: () => Promise<typeof WatchesAnswer.Encoded>;
  readonly findings: (input: WatchInput) => Promise<typeof FindingsAnswer.Encoded>;
  readonly manageSandbox: (input: SandboxManageInput) => Promise<typeof SandboxAnswer.Encoded>;
  /** The count of schema migrations the mech's own tables have applied. */
  readonly schemaRevision: () => Promise<number>;
  readonly create: (input: CreateMechInput) => Promise<typeof MechRecord.Encoded>;
  readonly show: () => Promise<typeof MechAnswer.Encoded>;
  readonly update: (input: UpdateMechInput) => Promise<typeof MechUpdateAnswer.Encoded>;
  readonly revisions: (input: MechRevisionsInput) => Promise<typeof MechRevisionsAnswer.Encoded>;
  readonly sendInboxItem: (input: SendInboxItemInput) => Promise<typeof InboxItemReceipt.Encoded>;
  readonly events: (input: EventsInput) => Promise<typeof EventsAnswer.Encoded>;
  readonly turn: (input: TurnInput) => Promise<TurnReading>;
  readonly cancelTurn: (input: CancelTurnInput) => Promise<typeof TurnCancelAnswer.Encoded>;
  readonly memories: () => Promise<typeof MemoriesAnswer.Encoded>;
  readonly threads: (input: ThreadsInput) => Promise<typeof ThreadsAnswer.Encoded>;
  readonly drones: (input: DronesInput) => Promise<typeof DronesAnswer.Encoded>;
  readonly drone: (input: DroneInput) => Promise<typeof DroneAnswer.Encoded>;
  readonly cancelDrone: (input: CancelDroneInput) => Promise<typeof DroneCancelAnswer.Encoded>;
  readonly fork: (input: ForkInput) => Promise<typeof ForkAnswer.Encoded>;
  readonly receiveCopy: (input: CopyStepInput) => Promise<void>;
};
