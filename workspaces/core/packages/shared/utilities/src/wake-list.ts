import { Duration, Option } from 'effect';
import { WaitEnd } from './constants.ts';
import type { WakeList } from './types.ts';

/** How a wait ended. */
type EndInput = { readonly cause: WaitEnd };

/** The timer that ends a wait at its timeout. */
type Timer = ReturnType<typeof setTimeout>;

/**
 * Waits that one wake releases together. Each wait also ends at its timeout, once its stop settles, or at its cancel,
 * whichever comes first, and it leaves the list and clears its timer as it ends. It lives as long as its owner.
 */
export function wakeList(): WakeList {
  const waits = new Set<() => void>();

  const wake: WakeList['wake'] = () => {
    for (const release of waits) {
      release();
    }
  };

  const wait: WakeList['wait'] = ({ timeout, stop }) => {
    const ending = Promise.withResolvers<WaitEnd>();

    const end: (input: EndInput) => void = ({ cause }) => {
      if (Option.isSome(timer)) {
        clearTimeout(timer.value);
      }

      waits.delete(release);
      ending.resolve(cause);
    };

    const release: () => void = () => end({ cause: WaitEnd.Woken });
    const timedOut: () => void = () => end({ cause: WaitEnd.TimedOut });
    const stopped: () => void = () => end({ cause: WaitEnd.Stopped });
    const cancel: () => void = () => end({ cause: WaitEnd.Canceled });
    const arm: (span: Duration.Duration) => Timer = (span) => setTimeout(timedOut, Duration.toMillis(span));
    const timer = Option.map(timeout, arm);

    waits.add(release);

    if (Option.isSome(stop)) {
      void stop.value.then(stopped, stopped);
    }

    return { ended: ending.promise, cancel };
  };

  return { wake, wait };
}
