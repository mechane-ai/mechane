import type { Event, MechRevisionPage } from '@mechane/protocol';
import type { Sequence, TurnId } from '@mechane/records';
import type { AlarmControl, AlarmTimeInput, AsyncTransaction, RowsPage } from '@mechane/store';
import type { DateTime, Option } from 'effect';
import type { MechRevisionRow } from './definition.schemas.ts';
import type { DroneEndRecords, DroneRecords } from './drone.types.ts';
import type { FindingRecords } from './findings/finding-records.ts';
import type { CopyRecords, ForkRecords } from './fork.types.ts';
import type { MemoryRecords } from './memory.types.ts';
import type { DispatchWork, InboxItemRow, MechRow, PendingItemRow } from './schemas.ts';
import type { slackDeliveryProgressRecords } from './slack/slack-delivery-progress-records.ts';
import type { slackDeliveryRecords } from './slack/slack-delivery-records.ts';
import type { slackOriginRecords } from './slack/slack-origin-records.ts';
import type { sourceRecords } from './sources/source-records.ts';
import type { ThreadRecords } from './thread.types.ts';
import type { TurnEndRecords, TurnRecords } from './turn.types.ts';
import type { WatchRecords } from './watches/watch-records.ts';

type SlackDeliveryProgressRecords = Readonly<ReturnType<typeof slackDeliveryProgressRecords>>;
type SlackDeliveryRecords = Readonly<ReturnType<typeof slackDeliveryRecords>>;
type SlackOriginRecords = Readonly<ReturnType<typeof slackOriginRecords>>;

/** Each variant of a union without the keys `K`. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An event without its place in the log and its time, which the log assigns as it appends it. */
export type EventDraft = DistributiveOmit<Event, 'sequence' | 'occurredAt'>;

/** An inbox item the mech receives, as it records it. */
export type ReceiveInboxItemInput = { readonly inboxItem: InboxItemRow };

/** The inbox item a record function reads or changes. */
export type InboxItemIdInput = { readonly inboxItemId: string };

/** A silent inbox item that entered the conversation, and when. */
export type WriteInboxItemInput = { readonly inboxItemId: string; readonly now: DateTime.Utc };

/** An event to append, and when it occurred. */
export type AppendEventInput = { readonly event: EventDraft; readonly now: DateTime.Utc };

/** The sequence a page of the log starts after, 0 for its start. */
export type EventsAfterInput = { readonly after: number };

/** The record functions of a mech's inbox items, from their receipt to the turn or the conversation they enter. */
export type InboxItemRecords = {
  readonly receiveInboxItem: (input: ReceiveInboxItemInput) => void;
  /** The inbox item of the id, none for an id the mech never received. */
  readonly inboxItem: (input: InboxItemIdInput) => Option.Option<InboxItemRow>;
  /** The turn the item entered, none while it waits; pi moves only items the mech received. */
  readonly itemTurn: (input: InboxItemIdInput) => Option.Option<TurnId>;
  /** Records that a silent item entered the conversation, and answers its id, none when it had already. */
  readonly writeInboxItem: (input: WriteInboxItemInput) => Option.Option<string>;
  /**
   * The items pi may still move, oldest first: those waiting for a turn or in the running one, and the silent ones not
   * written yet.
   */
  readonly pendingInboxItems: () => ReadonlyArray<PendingItemRow>;
};

/** The mech an object comes to hold, at its creation or at the end of its copy. */
export type CreateMechInput = { readonly mech: MechRow };

/** The provider session id a dispatch's conversation sends, which tells a drone's dispatch from its mech's. */
export type DispatchSessionInput = { readonly sessionId: string };

/** Where a dispatch counts: its mech's workspace, id and daily cap, and its work. */
export type DispatchTarget = {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly dailyCapMicros: number;
  readonly work: DispatchWork;
};

/** The record functions of a mech's log of events, dense and in commit order. */
export type EventRecords = {
  /**
   * Appends an event after the log's last one, and answers its sequence; it runs in the transaction that makes the
   * change it reports.
   */
  readonly appendEvent: (input: AppendEventInput) => Sequence;
  /** The stored `/v1` JSON of the events after `after`, oldest first, a page at a time. */
  readonly eventsAfter: (input: EventsAfterInput) => RowsPage<string>;
  /** The sequence of the log's last event, 0 before the first. */
  readonly lastSequence: () => Sequence;
};

/** The record functions of the mech an object holds. */
export type MechRecords = {
  readonly createMech: (input: CreateMechInput) => void;
  /** The mech the object holds, none before its creation. */
  readonly mech: () => Option.Option<MechRow>;
  readonly updateMech: (input: CreateMechInput) => void;
  /** The revision pinned for dispatches until the host reaches a boundary with no running turn or drone. */
  readonly activeDefinition: () => MechRevisionRow;
  /** Pins a saved revision for subsequent work; the host calls this only at a safe activation boundary. */
  readonly activateDefinition: (input: DefinitionRevisionInput) => void;
  /** Returns none before creation or when the workspace roster already covers the latest saved revision. */
  readonly pendingMechIndex: () => Option.Option<MechRow>;
  /** Acknowledges a projected revision without clearing any later revision still owed to the roster. */
  readonly markMechIndexed: (input: DefinitionRevisionInput) => void;
  readonly mechRevisions: (input: RevisionsAfterInput) => MechRevisionPage;
  /** Where the dispatch now being reserved counts: it runs only in a drone or a turn of a created mech. */
  readonly dispatchTarget: (input: DispatchSessionInput) => DispatchTarget;
};

export type DefinitionRevisionInput = { readonly revision: number };

export type RevisionsAfterInput = { readonly after: number };

/** The object's one alarm, which every call sets outside a transaction. */
export type MechAlarm = AlarmControl & {
  /** Arms the alarm for `at` unless it is armed earlier, as a send does for its item and an open for its retry. */
  readonly armBy: (input: AlarmTimeInput) => Promise<void>;
};

/** The mech's storage, and the transaction of the database client it shares with pi. */
export type OpenMechStoreInput = { readonly storage: DurableObjectStorage; readonly transaction: AsyncTransaction };

/** The mech's storage, which holds its database and its alarm. */
export type MechStorageInput = { readonly storage: DurableObjectStorage };

/** The rows a statement returned, such as those an update's `RETURNING` names. */
export type CursorInput = { readonly cursor: SqlStorageCursor<Readonly<Record<string, SqlStorageValue>>> };

/** Every record function of a mech's own tables, which only a run of the store's transaction receives. */
export type MechTables = MechRecords &
  ReturnType<typeof sourceRecords> &
  SlackDeliveryRecords &
  SlackDeliveryProgressRecords &
  SlackOriginRecords &
  WatchRecords &
  FindingRecords &
  InboxItemRecords &
  TurnRecords &
  TurnEndRecords &
  EventRecords &
  MemoryRecords &
  ThreadRecords &
  DroneRecords &
  DroneEndRecords &
  ForkRecords &
  CopyRecords & {
    /** The count of schema migrations the mech's own tables have applied. */
    readonly schemaRevision: () => number;
  };

/** Statements to run as one transaction, against the tables the transaction hands them. */
export type TablesRun<A> = { readonly run: (tables: MechTables) => A };

/**
 * A mech's own database; the store is the only code that runs host SQL against the mech's object. Its transaction
 * queues behind pi's commits on the client the mech shares with pi. It is the only way to the tables, so no host
 * statement runs outside one, and none joins a pi transaction.
 */
export type MechStore = { readonly atomic: <A>(input: TablesRun<A>) => Promise<A> };
