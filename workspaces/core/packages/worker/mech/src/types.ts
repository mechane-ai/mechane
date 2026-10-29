import type { ChangesInput, MechHarness } from '@mechane/harness';
import type { MechMeter, RecordedSignal } from '@mechane/mech-ports';
import type { MechAlarm, MechStore, MechTables, TablesRun } from '@mechane/mech-store';
import type { DroneId } from '@mechane/records';
import type { ObjectSettings } from '@mechane/rpc';
import type { PageAfterInput } from '@mechane/store';
import type { WakeList } from '@mechane/utilities';
import type { DateTime } from 'effect';

/** The tables a projection writes, the inbox items pi placed in a turn, and when. */
export type PlacedItemsInput = {
  readonly store: MechTables;
  readonly inboxItemIds: ReadonlyArray<string>;
  readonly now: DateTime.Utc;
};

/** The instant a call read the clock at, which every write it decides records. */
export type NowInput = { readonly now: DateTime.Utc };

/** An open mech: what its methods and its alarm work through. */
export type OpenedMech = {
  readonly store: MechStore;
  /** The settings that bind the mech's sandboxes and ledger, and bound its alarm's work. */
  readonly settings: ObjectSettings;
  readonly harness: MechHarness;
  readonly meter: MechMeter;
  readonly alarm: MechAlarm;
  readonly signal: WakeList;
  /** What a send, a cancel, a drone or a turn's unanswered end marks, for the alarm's work to apply. */
  readonly recorded: RecordedSignal;
  /** Enqueues the projection of pi's progress behind every host transaction queued before it; it must not block. */
  readonly project: (input: ChangesInput) => void;
};

/**
 * An RPC decision's answer, and whether it leaves the alarm work: an item to deliver or a turn to close, none when the
 * call was refused.
 */
export type AlarmDecision<A> = { readonly answer: A; readonly isAlarmDue: boolean };

/** A running drone whose brief pi lacks: its brief, the model its mech runs on, and whether a member canceled it. */
export type DroneLaunch = {
  readonly droneId: DroneId;
  readonly brief: string;
  readonly modelId: string;
  readonly isCanceled: boolean;
};

/**
 * The object's hold on its open mech: the open itself, the transactions its methods run, and the reopens of an alarm's
 * hand-off and of a fork's copy.
 */
export type MechHandle = {
  readonly current: () => Promise<OpenedMech>;
  /** Runs one transaction that calls no pi and leaves the alarm no work. */
  readonly atomic: <A>(input: TablesRun<A>) => Promise<A>;
  /**
   * Decides in one transaction, then arms the alarm for now when the decision left it work. Pi's work outlives the call
   * that starts it, so no RPC method calls pi, and the alarm applies what this records.
   */
  readonly recordForAlarm: <A>(input: TablesRun<AlarmDecision<A>>) => Promise<A>;
  /** Closes pi's Harness and opens the mech again; it resolves once the new open has. */
  readonly reopen: () => Promise<void>;
  /** Closes pi's Harness, deletes the whole database, and opens the mech on it empty, as a copy's begin does. */
  readonly reopenEmpty: () => Promise<void>;
};

/** The mech's tables, which a decision or a read runs on inside one transaction. */
export type TablesInput = { readonly store: MechTables };

/** A page of one of the mech's lists, read from its tables. */
export type PageInput = TablesInput & PageAfterInput;

/** A kind of item progress the projection tests for, answered for every kind pi reports. */
export type ProgressTest = Readonly<Record<ChangesInput['changes'][number]['progress']['_tag'], () => boolean>>;
