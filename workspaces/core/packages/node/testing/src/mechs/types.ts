import type { KnownTrace } from '@mechane/program';
import type { Delivery, Event, InboxItem } from '@mechane/protocol';
import type { Stack } from '@mechane/stack';
import type { Effect, Schema } from 'effect';
import type { FileStepFailed } from '../errors.ts';
import type { Account, ScenarioFailure } from '../types.ts';
import type { EventFollower, TurnEndEvent } from './events/types.ts';

/** A mech of an account on the stack, by its id. */
export type MechInput = { readonly stack: Stack; readonly account: Account; readonly mechId: string };

/** A follower of a mech's events from after the sequence `after`, 0 to read its log from the first. */
export type FollowEventsInput = MechInput & AfterInput;

/** The sequence after which a read of a mech's log starts, 0 to read it from the first event. */
export type AfterInput = { readonly after: number };

/** The text of a turn to start. */
export type TextInput = { readonly text: string };

/** An inbox item to send again under the id of an earlier send. */
export type ResendInput = { readonly text: string; readonly inboxItemId: string };

/** A request the scripted upstream answered, with the usage it reported. */
type AnsweredRequest = ReturnType<Stack['modelUpstream']['requests']>[number];

/** A turn a send started: its item, the event that ended it, the requests the upstream got meanwhile, its trace. */
export type MechTurn = {
  readonly sent: InboxItem;
  readonly ended: TurnEndEvent;
  readonly requests: ReadonlyArray<AnsweredRequest>;
  readonly trace: KnownTrace;
};

/** An inbox item to send with its delivery. */
export type SendInput = { readonly text: string; readonly delivery: Delivery };

/**
 * A mech of an account, whose events its follower reads as they happen. A turn sends text and follows it to its end, a
 * send only sends it, and a resend repeats an earlier send under its item's id. A command runs on the mech, and a log
 * read lists its events after a sequence.
 */
export type TalkingMech = {
  readonly id: string;
  readonly account: Account;
  readonly follower: EventFollower;
  readonly turn: (input: TextInput) => Effect.Effect<MechTurn, ScenarioFailure>;
  readonly send: (input: SendInput) => Effect.Effect<InboxItem, ScenarioFailure>;
  readonly resend: (input: ResendInput) => Effect.Effect<InboxItem, ScenarioFailure>;
  readonly command: <S extends Schema.Codec<unknown, unknown>>(
    input: MechCommandInput<S>,
  ) => Effect.Effect<S['Type'], ScenarioFailure>;
  readonly logged: (input: AfterInput) => Effect.Effect<ReadonlyArray<Event>, ScenarioFailure>;
};

/** A CLI command on a mech: the words before its id, the ids of its records after it, and its result's schema. */
export type MechCommandInput<S> = {
  readonly words: ReadonlyArray<string>;
  readonly ids: ReadonlyArray<string>;
  readonly result: S;
};

/**
 * A gate for a command: the bash that records each run and then waits until the gate opens. It also holds a wait for
 * the first run, the opening, and the count of runs so far.
 */
export type CommandGate = {
  readonly bash: string;
  readonly awaitRun: Effect.Effect<void, FileStepFailed>;
  readonly open: Effect.Effect<void, FileStepFailed>;
  readonly runs: Effect.Effect<number, FileStepFailed>;
};

/** The runs file of a command gate, one line per run of the gated command. */
export type GateRunsInput = { readonly runsFile: string };
