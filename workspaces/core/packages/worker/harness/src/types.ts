import type { Extension, Harness, ToolRegistration, Wake } from '@earendil-works/pi-durable';
import type { SqliteStorage } from '@earendil-works/pi-durable/storage/sqlite';
import type { ModelOffer } from '@mechane/deployment';
import type { Delivery, NOTED_REASONS } from '@mechane/protocol';
import type { AlarmControl, AsyncTransaction } from '@mechane/store';
import type { DateTime, Option, Redacted } from 'effect';
import type { DroneIdInput } from './drones/types.ts';
import type { DispatchMeter } from './models/types.ts';
import type { ChangesInput, ItemProgressReport } from './progress/types.ts';

/** The threads extension and tools that only the mech conversation may call. */
export type DroneSelection = { readonly threads: Extension; readonly rootTools: ReadonlyArray<ToolRegistration> };

/** A drone to open in the mech's Harness, under its id, with the model its mech runs on. */
export type DroneOpening = { readonly droneId: string; readonly modelId: string };

/** A drone's brief to submit to the conversation its opening created. */
export type DroneBriefing = { readonly droneId: string; readonly brief: string };

/** The agent a mech's conversation runs with: its offer and its instructions. */
export type MechAgent = {
  readonly modelId: string;
  /** The mech's own instructions, none for a mech created without any. */
  readonly instructions: Option.Option<string>;
};

type NotedReason = (typeof NOTED_REASONS)[number];

/**
 * A turn whose note the conversation has not received: a canceled turn, which may still run, or a faulted one. It
 * carries the turn's items, why it ends without a reply, and since when the note is owed.
 */
export type OwedNote = {
  readonly turnId: string;
  readonly inboxItemIds: ReadonlyArray<string>;
  readonly reason: NotedReason;
  readonly owedAt: DateTime.Utc;
};

/** What ends the alarm's wait for pi's work before pi has nothing left that can run: the alarm's hand-off. */
export type StopInput = { readonly stop: Promise<unknown> };

/** The inbox items and the drones whose progress to read. */
export type ProgressQuery = { readonly inboxItemIds: ReadonlyArray<string>; readonly droneIds: ReadonlyArray<string> };

/** The model upstream a mech's dispatches go to, its key, and the offers it serves. */
export type ModelUpstream = {
  readonly upstream: URL;
  readonly apiKey: () => Promise<Redacted.Redacted>;
  readonly offers: ReadonlyArray<ModelOffer>;
};

/** The one database client of a mech, which pi's commits and the host's transactions queue on together. */
export type SharedDatabase = {
  /** Runs host statements as one transaction behind every pi commit and host transaction queued before it. */
  readonly transaction: AsyncTransaction;
  readonly openPiStorage: () => Promise<SqliteStorage>;
};

export type ArmAlarmInput = {
  readonly alarm: AlarmControl;
  readonly wake: Wake;
  /** Whether the caller holds work for the alarm to start now, such as an inbox item pi never admitted. */
  readonly isDue: boolean;
};

/** A failure a mech cannot go on past: the step that failed and its cause. */
export type ObjectFailure = { readonly operation: string; readonly cause: unknown };

/** Resets the mech's object, naming the mech, the step and its cause, so its next event or alarm opens it again. */
export type AbortObject = (input: ObjectFailure) => void;

/** A mech's Harness to open: its database, upstream and meter, and the extensions the mech built its tools into. */
export type OpenMechHarnessInput = MechExtensions & {
  readonly database: SharedDatabase;
  readonly modelUpstream: ModelUpstream;
  readonly meter: DispatchMeter;
  readonly alarm: AlarmControl;
  /** The mech that log lines name, none for an object whose mech does not exist yet. */
  readonly mechId: Option.Option<string>;
  readonly abortObject: AbortObject;
  /** Called synchronously after each pi commit that moved an inbox item or ended a brief; it must not block. */
  readonly onChanges: (input: ChangesInput) => void;
};

/** The extensions every conversation of a mech selects by default, and what a drone's conversation leaves out. */
export type MechExtensions = { readonly extensions: ReadonlyArray<Extension>; readonly selection: DroneSelection };

/** pi's announcements that what it needs next changed, which a wait for its work to end listens to. */
export type WakeSignal = {
  readonly announce: () => void;
  /** Answers once pi has nothing it can run now, checked first, or `stop` settles, and whether `stop` ended it. */
  readonly untilIdle: (input: UntilIdleInput) => Promise<boolean>;
};

export type UntilIdleInput = HarnessHandle & StopInput;

/**
 * An inbox item as pi receives it: its id, which is pi's request id, its text, how it reaches the mech, and when the
 * mech received it.
 */
type DeliveredItem = {
  readonly id: string;
  readonly text: string;
  readonly delivery: Delivery;
  readonly receivedAt: DateTime.Utc;
};

export type DeliverInput = { readonly inboxItem: DeliveredItem; readonly agent: MechAgent };

/** The opened Harness a function of the harness calls. */
export type HarnessHandle = { readonly harness: Harness };

export type SubmissionDraftInput = { readonly inboxItem: DeliveredItem };

/**
 * The harness functions a mech's object calls; pi's own vocabulary ends at this boundary. Only the alarm delivers and
 * works: pi's work outlives the call that starts it, and the alarm's event is the one that waits for it to end.
 */
export type MechHarness = {
  /** Submits an inbox item to the mech's conversation under the item's id, which pi admits once. */
  readonly deliver: (input: DeliverInput) => Promise<void>;
  /** Stops what pi still runs of a canceled or faulted turn and writes its note, which pi admits once. */
  readonly close: (input: OwedNote) => Promise<void>;
  /** Reads what pi holds of the items and the drones' briefs, in a commit that writes nothing and starts no work. */
  readonly progress: (input: ProgressQuery) => Promise<ItemProgressReport>;
  /** Opens a drone's ownerless conversation, which its first opening creates, and answers its provider session id. */
  readonly openDrone: (input: DroneOpening) => Promise<string>;
  /** Submits an opened drone's brief under the drone's id, which pi admits once. */
  readonly deliverBrief: (input: DroneBriefing) => Promise<void>;
  /** Stops what an opened drone's conversation runs or queues, and waits until it is idle. */
  readonly abortDrone: (input: DroneIdInput) => Promise<void>;
  /**
   * Lets pi work until nothing can run now, then arms the alarm for its earliest sleep, clearing it when it has none;
   * or until `stop` settles, and then arms nothing. Answers whether `stop` ended the work.
   */
  readonly work: (input: StopInput) => Promise<boolean>;
  /** Arms the alarm for now when pi or the caller has work due, else for pi's earliest sleep, or else clears it. */
  readonly armNext: (input: Pick<ArmAlarmInput, 'isDue'>) => Promise<void>;
  /** Gives the mech's conversation a provider session id of its own, as a fork's first open does. */
  readonly renewProvider: () => Promise<void>;
  /** Closes pi's Harness and its storage once its line ran what pi began, so the object can open its database anew. */
  readonly release: () => Promise<void>;
};
