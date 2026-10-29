import type { DispatchMeter } from '@mechane/harness';
import { abortRejection, afterFailing, wakeList } from '@mechane/utilities';
import { DateTime, Option } from 'effect';
import type { MechMeter } from '../types.ts';
import { closedOnEnd } from './closed-on-end.ts';

type DrainableMeterInput = { readonly meter: DispatchMeter };

/**
 * The meter's open dispatches: whether their drain started, the opening of a dispatch, which answers its close, and
 * their drain.
 */
type OpenDispatches = Pick<MechMeter, 'drain'> & {
  readonly isDraining: () => boolean;
  readonly open: () => () => void;
};

/**
 * The meter with its open dispatches counted, each from the start of its reservation until the reservation is refused
 * or fails, or its settlement ends. The alarm drains it before it hands pi on: from then on, a dispatch reserves and
 * sends nothing, and fails once pi aborts its request, as pi's close does.
 */
export function drainableMeter({ meter }: DrainableMeterInput): MechMeter {
  const dispatches = openDispatches();

  const reserve: DispatchMeter['reserve'] = async (dispatch) => {
    // A dispatch the drain holds reserves nothing, and fails with the abort's reason once pi aborts its request.
    if (dispatches.isDraining()) {
      return await abortRejection({ signal: dispatch.signal });
    }

    const close = dispatches.open();
    const reservation = await afterFailing({ promise: meter.reserve(dispatch), run: close });

    return closedOnEnd({ reservation, close });
  };

  return { reserve, drain: dispatches.drain };
}

/**
 * The meter's open dispatches, held in memory, and their drain, which answers how many stay open once none does, or at
 * its deadline.
 */
function openDispatches(): OpenDispatches {
  const open = new Set<symbol>();
  const drain = { isStarted: false };
  const closedAll = wakeList();

  const openDispatch: OpenDispatches['open'] = () => {
    const dispatch = Symbol('dispatch');

    const close: () => void = () => {
      open.delete(dispatch);

      if (drain.isStarted && open.size === 0) {
        closedAll.wake();
      }
    };

    open.add(dispatch);

    return close;
  };

  const drainDispatches: OpenDispatches['drain'] = async ({ deadline }) => {
    drain.isStarted = true;

    if (open.size > 0) {
      const timeout = Option.some(DateTime.distance(DateTime.nowUnsafe(), deadline));

      await closedAll.wait({ timeout, stop: Option.none() }).ended;
    }

    return open.size;
  };

  return { isDraining: () => drain.isStarted, open: openDispatch, drain: drainDispatches };
}
