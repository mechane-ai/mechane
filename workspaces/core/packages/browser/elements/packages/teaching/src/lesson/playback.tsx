import { stepValue } from '@ui-sdk/core/number';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { NumberParam } from './define-lesson.ts';
import { useLessonScope } from './lesson-context.ts';
import type { LessonScope } from './lesson-context.ts';
import { failLesson, LessonError } from './lesson-error.tsx';
import type { PlaybackPace, PlaybackRun, PlayOrigin } from './lesson-player.ts';
import type { LessonChangeOrigin } from './lesson-store.ts';
import { lessonParam } from './param.tsx';

export type PlaybackProps = {
  /** The number param the player moves. */
  readonly name: string;
  /** Where play starts and starts over. Defaults to the param's min. */
  readonly from?: number | undefined;
  /** Where play ends. Defaults to the param's max. */
  readonly to?: number | undefined;
  /**
   * How many steps a second, by name, or a timed run. A run of `long` crosses the whole range in ten seconds however
   * many steps it has. Its `isEased` lets it start fast and settle.
   */
  readonly pace?: PlaybackPace | PlaybackRun | undefined;
  /** Starts over from `from` at the end instead of stopping there. */
  readonly isLooping?: boolean | undefined;
};

/** What `usePlayback` returns: whether the player runs, and the calls that run, stop and move it. */
export type PlaybackControls = {
  readonly isPlaying: boolean;
  /** Starts playing. At the end it starts over from `from`; with reduced motion it shows the end at once. */
  readonly play: (origin?: PlayOrigin) => void;
  readonly pause: (origin?: PlayOrigin) => void;
  readonly toggle: (origin?: PlayOrigin) => void;
  /** Moves the param by whole steps, within the player's range, and pauses. */
  readonly stepBy: (steps: number, origin?: LessonChangeOrigin) => void;
  /** Moves the param to a value within the player's range, and pauses. */
  readonly seek: (value: number, origin?: LessonChangeOrigin) => void;
};

/** The range a player moves its param through: its `from` and `to`, or the param's bounds before it registers. */
export function playerRange(
  scope: LessonScope,
  name: string,
  param: NumberParam,
): { readonly from: number; readonly to: number } {
  const player = new Map(Object.entries(scope.state.players)).get(name);

  return { from: player?.from ?? param.min, to: player?.to ?? param.max };
}

function playbackProblem({
  scope,
  name,
  from,
  to,
}: {
  readonly scope: LessonScope;
  readonly name: string;
  readonly from: number | undefined;
  readonly to: number | undefined;
}): string | undefined {
  const found = lessonParam(scope, name);

  if ('error' in found) {
    return found.error;
  }

  const { param } = found;

  if (param.kind !== 'number') {
    return `Playback needs a number param, and "${name}" is a ${param.kind} param.`;
  }

  const start = from ?? param.min;
  const end = to ?? param.max;
  const isInRange = start >= param.min && end <= param.max && start < end;

  return isInRange ? undefined : `Playback of "${name}" needs ${param.min} ≤ from < to ≤ ${param.max}.`;
}

/**
 * Drives a number param over time on the lesson's shared clock, a step at a time or as one timed run: a training step,
 * a token index, a temperature sweep. It renders nothing; a `Transport` or `usePlayback` plays it. It pauses when the
 * tab is hidden or the reader changes the value, and with reduced motion play shows the end at once.
 */
export function Playback({ name, from, to, pace = 'regular', isLooping = false }: PlaybackProps): ReactNode {
  const scope = useLessonScope('Playback');
  // Primitives, so a pace written inline does not register the player again on every render.
  const [steps, run] = typeof pace === 'string' ? ([pace, undefined] as const) : ([undefined, pace.run] as const);
  const isEased = typeof pace !== 'string' && pace.isEased === true;
  const problem = playbackProblem({ scope, name, from, to });
  const found = lessonParam(scope, name);
  const bounds = 'param' in found && found.param.kind === 'number' ? found.param : { min: 0, max: 0 };
  const start = from ?? bounds.min;
  const end = to ?? bounds.max;
  const { api } = scope;

  useEffect(() => {
    if (problem !== undefined) {
      return;
    }

    return api.register({ name, from: start, to: end, pace: run === undefined ? steps : { run, isEased }, isLooping });
  }, [api, problem, name, start, end, steps, run, isEased, isLooping]);

  return problem === undefined ? null : <LessonError>{problem}</LessonError>;
}

/** Plays, pauses and moves the player of a number param in the nearest lesson. */
export function usePlayback(name: string): PlaybackControls {
  const scope = useLessonScope('usePlayback');
  const isPlaying = scope.state.playing === name;
  const { api } = scope;

  function numberParam(): NumberParam {
    const found = lessonParam(scope, name);

    if ('error' in found) {
      return failLesson(scope.lesson.id, found.error);
    }

    return found.param.kind === 'number'
      ? found.param
      : failLesson(scope.lesson.id, `"${name}" is a ${found.param.kind} param, so no player can move it.`);
  }

  function seek(value: number, origin?: LessonChangeOrigin): void {
    const range = playerRange(scope, name, numberParam());

    api.apply(name, Math.min(range.to, Math.max(range.from, value)), origin ?? { reason: 'imperative' });
  }

  return {
    isPlaying,
    play: (origin) => api.play(name, origin),
    pause: (origin) => api.pause(origin),
    toggle: (origin) => (isPlaying ? api.pause(origin) : api.play(name, origin)),
    stepBy: (steps, origin) => {
      const param = numberParam();
      const current = Number(scope.state.values[name]);

      seek(
        stepValue(current, steps, { min: param.min, max: playerRange(scope, name, param).to, step: param.step }),
        origin ?? { reason: 'press' },
      );
    },
    seek,
  };
}
