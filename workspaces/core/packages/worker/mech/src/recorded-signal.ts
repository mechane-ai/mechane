import type { RecordedSignal } from '@mechane/mech-ports';

/**
 * Whether work was recorded for the alarm since the alarm last looked: a send, a cancel, a drone's start or report, or
 * a turn that ended unanswered. Each marks it, and the alarm's work takes it while pi works, so what arrives meanwhile
 * reaches pi in the alarm's event without waiting for that work to end.
 */
export function recordedSignal(): RecordedSignal {
  const signal = { isMarked: false };

  const mark: RecordedSignal['mark'] = () => {
    signal.isMarked = true;
  };

  const take: RecordedSignal['take'] = () => {
    const { isMarked } = signal;

    signal.isMarked = false;

    return isMarked;
  };

  return { mark, take };
}
