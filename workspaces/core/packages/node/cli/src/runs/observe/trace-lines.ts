import { TurnStatus, UnknownTurn } from '@mechane/protocol';
import type { Trace, Turn } from '@mechane/protocol';
import { DateTime, Schema } from 'effect';
import { UNKNOWN_KIND_NOTE } from '../constants.ts';
import { dispatchLine } from './dispatch-line.ts';

type TraceLinesInput = { readonly trace: Trace };

type TurnLineInput = { readonly turn: Turn | UnknownTurn };

/** A turn as a person reads it: its outcome and times, then each of its model requests in the order decided. */
export function traceLines({ trace }: TraceLinesInput): ReadonlyArray<string> {
  return [turnLine({ turn: trace.turn }), ...trace.dispatches.map((dispatch) => dispatchLine({ dispatch }))];
}

/** A turn's line: its id, status and times, why it ended unanswered, and the inbox items it took. */
function turnLine({ turn }: TurnLineInput): string {
  if (Schema.is(UnknownTurn)(turn)) {
    return `turn ${turn.id} ${turn.status}, ${UNKNOWN_KIND_NOTE}`;
  }

  const heading = `turn ${turn.id} ${turn.status}, started ${DateTime.formatIso(turn.startedAt)}`;
  const items = `for ${turn.inboxItemIds.join(', ')}`;

  switch (turn.status) {
    case TurnStatus.Running:
      return `${heading} ${items}`;
    case TurnStatus.Answered:
      return `${heading}, ended ${DateTime.formatIso(turn.endedAt)} ${items}`;
    case TurnStatus.Unanswered:
      return `${heading}, ended ${DateTime.formatIso(turn.endedAt)} (${turn.reason}) ${items}`;
  }
}
