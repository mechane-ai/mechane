import { isMotionReduced, onFrame } from './clock.ts';

/** How long a move takes. `instant` jumps, and so does every pace when the reader asked for reduced motion. */
export type Pace = 'instant' | 'fast' | 'regular' | 'slow';

/** A set of named numbers that eases toward a target on the shared clock. */
export type Tween<Key extends string> = {
  /** The values on screen now. The same object is returned until a frame changes them. */
  readonly get: () => Readonly<Record<Key, number>>;
  /** Moves to `target` from the values on screen, so a new target in the middle of a move is smooth. */
  readonly to: (target: Readonly<Record<Key, number>>, pace?: Pace) => void;
  /** Jumps to `target` without animating. */
  readonly jump: (target: Readonly<Record<Key, number>>) => void;
  readonly subscribe: (listener: () => void) => () => void;
  /** Stops any move in flight. The tween still answers `get` and can be moved again. */
  readonly destroy: () => void;
};

const paceDuration = { instant: 0, fast: 140, regular: 320, slow: 640 } as const;
const EASE_POWER = 4;

function idle(): void {
  // Nothing is moving, so there is nothing to stop.
}

/** Fast at first and settling gently, the curve the motion tokens use for interface transitions. */
function eased(progress: number): number {
  return 1 - (1 - progress) ** EASE_POWER;
}

function isSame<Key extends string>(
  first: Readonly<Record<Key, number>>,
  second: Readonly<Record<Key, number>>,
): boolean {
  const other = new Map(Object.entries<number>(second));
  const entries = Object.entries<number>(first);

  return entries.length === other.size && entries.every(([key, value]) => other.get(key) === value);
}

function mixed<Key extends string>(
  from: Readonly<Record<Key, number>>,
  target: Readonly<Record<Key, number>>,
  amount: number,
): Readonly<Record<Key, number>> {
  const starts = new Map(Object.entries<number>(from));

  return {
    ...target,
    ...Object.fromEntries(
      Object.entries<number>(target).map(([key, end]) => {
        const start = starts.get(key) ?? end;

        return [key, start + (end - start) * amount];
      }),
    ),
  };
}

/**
 * Makes a tween that starts at `initial`. Give it a new target with `to` and read `get` on each change: authors
 * describe where things are, and the tween supplies the motion between.
 */
export function createTween<Key extends string>(initial: Readonly<Record<Key, number>>): Tween<Key> {
  const listeners = new Set<() => void>();
  const move = { shown: initial, from: initial, target: initial, started: -1, duration: 0, stop: idle };

  function show(values: Readonly<Record<Key, number>>): void {
    move.shown = values;

    for (const listener of listeners) {
      listener();
    }
  }

  function halt(): void {
    move.stop();

    move.stop = idle;
  }

  function jump(target: Readonly<Record<Key, number>>): void {
    halt();

    move.target = target;

    if (!isSame(move.shown, target)) {
      show(target);
    }
  }

  function frame(now: number): void {
    if (move.started < 0) {
      move.started = now;
    }

    const progress = Math.min(1, (now - move.started) / move.duration);

    if (progress >= 1) {
      halt();
      show(move.target);

      return;
    }

    show(mixed(move.from, move.target, eased(progress)));
  }

  function to(target: Readonly<Record<Key, number>>, pace: Pace = 'regular'): void {
    if (isSame(move.target, target)) {
      return;
    }

    if (paceDuration[pace] === 0 || isMotionReduced()) {
      jump(target);

      return;
    }

    halt();

    move.from = move.shown;
    move.target = target;
    move.started = -1;
    move.duration = paceDuration[pace];
    move.stop = onFrame(frame);
  }

  return {
    get: () => move.shown,
    to,
    jump,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    destroy: halt,
  };
}
