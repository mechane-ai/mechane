import type { TurnStatus, UnansweredReason } from '@mechane/protocol';
import type { TurnId } from '@mechane/records';
import type { DateTime, Option } from 'effect';
import type { CancelRow, OwedNoteRow, RefusalRow, TurnRow } from './schemas.ts';

/** A turn that ended with a reply. */
type AnsweredEnd = { readonly status: typeof TurnStatus.Answered };

/** A turn that ended without a reply, for a reason. */
type UnansweredEnd = { readonly status: typeof TurnStatus.Unanswered; readonly reason: UnansweredReason };

/** How a turn ended. */
export type TurnEnd = AnsweredEnd | UnansweredEnd;

/** A new turn and the inbox items it takes up. */
export type OpenTurnInput = {
  readonly turnId: string;
  readonly inboxItemIds: ReadonlyArray<string>;
  readonly now: DateTime.Utc;
};

/** The turn a record function reads or changes. */
export type TurnIdInput = { readonly turnId: string };

/** An inbox item that joins a turn, its own or the one running when pi placed it. */
export type JoinTurnInput = { readonly turnId: string; readonly inboxItemId: string };

/** A running turn to end, how, and when. */
export type EndTurnInput = { readonly turnId: string; readonly end: TurnEnd; readonly now: DateTime.Utc };

/** A step a turn takes at a time: a refusal of one of its dispatches, or the write of its note. */
export type TurnStepInput = { readonly turnId: string; readonly now: DateTime.Utc };

/** A member's cancel of a running turn. */
export type CancelTurnInput = { readonly turnId: string; readonly cancelerId: string; readonly now: DateTime.Utc };

/** The record functions of a mech's turns and the inbox items each takes up. */
export type TurnRecords = {
  readonly openTurn: (input: OpenTurnInput) => void;
  /** The turn now running, none while the mech is idle. */
  readonly runningTurn: () => Option.Option<TurnId>;
  readonly joinTurn: (input: JoinTurnInput) => void;
  /** The turn of the id, none for an id the mech never ran. */
  readonly turn: (input: TurnIdInput) => Option.Option<TurnRow>;
  /** The ids of the inbox items the turn took up, in the order the mech received them. */
  readonly turnInboxItemIds: (input: TurnIdInput) => ReadonlyArray<string>;
};

/** The record functions of how a mech's turns end: their cancels, refusals, ends and notes. */
export type TurnEndRecords = {
  /** Ends a running turn and answers its id, none when an end came before, which stays. */
  readonly endTurn: (input: EndTurnInput) => Option.Option<string>;
  /** Records that the allowance refused one of the turn's dispatches. */
  readonly refuseTurn: (input: TurnStepInput) => void;
  /** The allowance's first refusal of one of the turn's dispatches, none while it refused none. */
  readonly turnRefusal: (input: TurnIdInput) => Option.Option<RefusalRow>;
  /** Records a cancel on a running turn not canceled yet, and answers it, none when the turn was not such a turn. */
  readonly cancelTurn: (input: CancelTurnInput) => Option.Option<CancelRow>;
  /** The cancel recorded on the turn, none for a turn never canceled. */
  readonly turnCancel: (input: TurnIdInput) => Option.Option<CancelRow>;
  /** The canceled and faulted turns whose note the mech's conversation has not received. */
  readonly owedNotes: () => ReadonlyArray<OwedNoteRow>;
  /** Records that the turn's note was written. */
  readonly noteTurn: (input: TurnStepInput) => void;
};
