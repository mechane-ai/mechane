import type { EventDraft, MechTables, TurnEnd } from '@mechane/mech-store';
import type { TurnId } from '@mechane/records';
import type { DateTime } from 'effect';

/** A cancel of a turn by a member, decided in the caller's transaction at the time of the call. */
export type RecordCancelInput = {
  readonly store: MechTables;
  readonly turnId: TurnId;
  readonly cancelerId: string;
  readonly now: DateTime.Utc;
};

/** How a turn ends, and the event that reports it. */
export type TurnEnding = { readonly end: TurnEnd; readonly event: EventDraft };
