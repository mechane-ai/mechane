import { useEffect, useState, useSyncExternalStore } from 'react';
import { createTween } from './tween.ts';
import type { Pace } from './tween.ts';

/**
 * An animated copy of `target`. The first render shows `target`, and each later change eases to the new values on the
 * shared clock, starting from whatever is on screen.
 */
export function useTween<Key extends string>(
  target: Readonly<Record<Key, number>>,
  pace: Pace = 'regular',
): Readonly<Record<Key, number>> {
  const [tween] = useState(() => createTween(target));

  useEffect(() => {
    tween.to(target, pace);
  });

  useEffect(() => tween.destroy, [tween]);

  return useSyncExternalStore(tween.subscribe, tween.get, tween.get);
}
