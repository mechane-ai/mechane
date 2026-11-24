function createClock(): (listener: (now: number) => void) => () => void {
  const listeners = new Set<(now: number) => void>();
  const loop = { isRunning: false };

  function tick(now: number): void {
    for (const listener of listeners) {
      listener(now);
    }

    if (listeners.size === 0) {
      loop.isRunning = false;

      return;
    }

    requestAnimationFrame(tick);
  }

  return (listener) => {
    listeners.add(listener);

    if (!loop.isRunning) {
      loop.isRunning = true;

      requestAnimationFrame(tick);
    }

    return () => {
      listeners.delete(listener);
    };
  };
}

/**
 * Calls `listener` once per animation frame while subscribed. One loop serves every subscriber, so everything that
 * moves on a page moves in step.
 */
export const onFrame = createClock();

/** Whether the reader asked for reduced motion. False where there is no window. */
export function isMotionReduced(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
