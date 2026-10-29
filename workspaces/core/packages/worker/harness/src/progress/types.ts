import type { CommitPublication, EntryRecord, SubmissionRecord } from '@earendil-works/pi-durable';
import type { DroneId } from '@mechane/records';
import type { Option } from 'effect';
import type { PiSubmissionType } from './constants.ts';
import type { ItemEnded, ItemPlaced, ItemWritten } from './schemas.ts';

/** An inbox item whose turn ended without a reply. */
export type ItemUnanswered = typeof ItemEnded.cases.Unanswered.Type;

/** An inbox item whose turn ended with a reply. */
export type ItemAnswered = typeof ItemEnded.cases.Answered.Type;

/** How far pi has taken an inbox item: into a turn, or through its turn's end, or into the conversation silently. */
export type ItemProgress = ItemPlaced | ItemEnded | ItemWritten;

/** One inbox item's progress, as one pi commit or the catch-up after an open reports it. */
export type ItemChange = { readonly inboxItemId: string; readonly progress: ItemProgress };

/** A drone's brief that pi ended: with the drone's final reply, its report, or without one. */
export type BriefEnd = { readonly droneId: DroneId; readonly progress: ItemEnded };

/** What one pi commit or a catch-up moved: inbox items, and the drones whose briefs ended. */
export type ChangesInput = { readonly changes: ReadonlyArray<ItemChange>; readonly droneEnds: ReadonlyArray<BriefEnd> };

/**
 * What pi holds of the inbox items and the drones a catch-up asks about: their progress, the items it never admitted,
 * and the drones whose brief it never admitted.
 */
export type ItemProgressReport = ChangesInput & {
  readonly missing: ReadonlyArray<string>;
  readonly unbriefed: ReadonlyArray<string>;
};

/** A submission whose request id a caller made, an item's or a drone's: a random UUID. */
export type RequestedSubmission = { readonly requestId: string; readonly record: SubmissionRecord };

/** What pi holds of one request: its submission and the answer entry it names, if any. */
export type ReadSubmission = {
  readonly requestId: string;
  /** The submission, none when pi never admitted the request. */
  readonly record: Option.Option<SubmissionRecord>;
  readonly answers: ReadonlyArray<EntryRecord>;
};

/** An input submission: an inbox item that is not silent, or a drone's brief. */
export type InputRecord = Extract<SubmissionRecord, InputType>;

/** The type of every input submission. */
type InputType = { readonly type: typeof PiSubmissionType.Input };

export type PublicationInput = { readonly publication: CommitPublication };
