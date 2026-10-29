import { DispatchStatus, UnknownDispatch } from '@mechane/protocol';
import type { TracedDispatch } from '@mechane/protocol';
import { Number, Option, Schema } from 'effect';

/** A role's turn's dispatches. */
type SavedDispatches = { readonly dispatches: ReadonlyArray<TracedDispatch> };

type SavedChargedMicrosInput = {
  /** None for a role's turn the trial never saved. */
  readonly record: Option.Option<SavedDispatches>;
};

type SettledMicrosInput = { readonly dispatch: TracedDispatch };

/**
 * What a role's saved turn's dispatches were charged, nothing for a turn never saved. A reservation that never settled
 * is charged nothing yet.
 */
export function savedChargedMicros({ record }: SavedChargedMicrosInput): number {
  const charged: (saved: SavedDispatches) => number = ({ dispatches }) => {
    const dispatchMicros = dispatches.map((dispatch) => settledMicros({ dispatch }));

    return Number.sumAll(dispatchMicros);
  };

  return Option.match(record, { onNone: () => 0, onSome: charged });
}

/**
 * What one dispatch was charged. A dispatch in a status this release does not know is charged its reservation, the most
 * it can cost, since its charge is unknown.
 */
function settledMicros({ dispatch }: SettledMicrosInput): number {
  if (Schema.is(UnknownDispatch)(dispatch)) {
    return dispatch.requested_micros;
  }

  switch (dispatch.status) {
    case DispatchStatus.Reserved:
    case DispatchStatus.Refused:
      return 0;
    case DispatchStatus.Settled:
      return dispatch.settledMicros;
  }
}
