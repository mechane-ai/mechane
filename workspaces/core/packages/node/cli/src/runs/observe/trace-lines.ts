import { TurnStatus, UnknownTurn } from '@mechane/protocol';
import type { Trace, Turn } from '@mechane/protocol';
import { DateTime, Option, Schema } from 'effect';
import { UNKNOWN_KIND_NOTE } from '../constants.ts';
import { dispatchLine } from './dispatch-line.ts';

type TraceLinesInput = { readonly trace: Trace };

type TurnLineInput = { readonly turn: Turn | UnknownTurn };

/** A turn as a person reads it: its outcome and times, then each of its model requests in the order decided. */
export function traceLines({ trace }: TraceLinesInput): ReadonlyArray<string> {
  return [turnLine({ turn: trace.turn }), ...trace.dispatches.map((dispatch) => dispatchLine({ dispatch }))];
}

function turnLine({ turn }: TurnLineInput): string {
  if (Schema.is(UnknownTurn)(turn)) {
    return `turn ${turn.id} ${turn.status}, ${UNKNOWN_KIND_NOTE}`;
  }

  const time = Option.match(turn.startedAt, {
    onNone: () => `created ${DateTime.formatIso(turn.createdAt)}`,
    onSome: (startedAt) => `started ${DateTime.formatIso(startedAt)}`,
  });

  const heading = `turn ${turn.id} ${turn.status}, ${time}`;
  const notifications = `for ${turn.notificationIds.join(', ')}`;

  switch (turn.status) {
    case TurnStatus.Queued:
    case TurnStatus.Running:
      return `${heading} ${notifications}`;
    case TurnStatus.Completed:
    case TurnStatus.Stopped:
      return `${heading}, ended ${DateTime.formatIso(turn.endedAt)} ${notifications}`;
    case TurnStatus.Failed:
      return `${heading}, ended ${DateTime.formatIso(turn.endedAt)} (${turn.reason}) ${notifications}`;
  }
}
