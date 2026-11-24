import type { ChangeSource } from '@ui-sdk/core';
import { scrubTo, stepValue } from '@ui-sdk/core/number';
import type { StepRange } from '@ui-sdk/core/number';
import { isMotionReduced, onFrame } from '../time/clock.ts';
import { eased } from '../time/tween.ts';

/** How fast a player moves its param, in steps per second. */
export const playbackPaces = { fast: 12, regular: 6, slow: 2 } as const;

/** A player's pace, from `playbackPaces`. */
export type PlaybackPace = keyof typeof playbackPaces;

/** How long a timed run takes from `from` to `to`, in seconds, whatever the number of steps between. */
export const playbackRuns = { short: 2, regular: 5, long: 10 } as const;

/** A timed run's length, from `playbackRuns`. */
export type PlaybackLength = keyof typeof playbackRuns;

/**
 * A whole run from `from` to `to` in a set time, such as a 320-step training run that takes `long`. With `isEased` the
 * value starts fast and settles, on the curve every tween uses.
 */
export type PlaybackRun = { readonly run: PlaybackLength; readonly isEased?: boolean | undefined };

/** A number param that a `Playback` drives: where it starts, where it ends and how fast it goes. */
export type LessonPlayer = {
  readonly name: string;
  readonly from: number;
  readonly to: number;
  readonly pace: PlaybackPace | PlaybackRun;
  readonly isLooping: boolean;
};

/** Why a player started or stopped: a press, the end of its run or a hidden tab, or a call. */
export type LessonPlayingChangeReason = 'press' | 'playback' | 'imperative';

/** What a start or stop says about itself: its reason, and the event and source when a reader caused it. */
export type PlayOrigin = {
  readonly reason: LessonPlayingChangeReason;
  readonly event?: Event | undefined;
  readonly source?: ChangeSource | undefined;
};

/** What the players need from the store. */
type PlayerHost = {
  /** The param playing now, or null. */
  readonly playing: () => string | null;
  /** Asks to start or stop a player. False when the application refused. */
  readonly setPlaying: (name: string | null, origin?: PlayOrigin) => boolean;
  readonly publish: (players: Readonly<Record<string, LessonPlayer>>) => void;
  readonly value: (name: string) => number;
  /** The step grid of a number param: its min and step, with the player's end as the max. */
  readonly grid: (player: LessonPlayer) => StepRange;
  readonly move: (name: string, value: number) => void;
  readonly refuse: (message: string) => never;
};

/** The players of one lesson, which move their params on the shared clock. */
export type LessonPlayers = {
  readonly register: (player: LessonPlayer) => () => void;
  readonly play: (name?: string, origin?: PlayOrigin) => void;
  readonly pause: (origin?: PlayOrigin) => void;
};

const MS_PER_SECOND = 1000;

function idle(): void {
  // Nothing is running, so there is nothing to stop.
}

/**
 * Makes a lesson's players. A player advances its param a step at a time at its pace, or along a timed run. It stops at
 * its end or starts over, and when the tab is hidden; with reduced motion, play shows the end at once.
 */
export function createPlayers(host: PlayerHost): LessonPlayers {
  const players = new Map<string, LessonPlayer>();
  const loop = { stop: idle, last: -1, budget: 0, started: -1, start: 0 };

  function pause(origin?: PlayOrigin): void {
    loop.stop();

    loop.stop = idle;

    if (host.playing() !== null) {
      host.setPlaying(null, origin);
    }
  }

  function finish(): void {
    pause({ reason: 'playback' });
  }

  function advance(player: LessonPlayer, count: number): void {
    const range = host.grid(player);
    const current = host.value(player.name);
    const next = stepValue(current, count, range);

    if (next === current) {
      if (player.isLooping) {
        host.move(player.name, player.from);
      } else {
        finish();
      }

      return;
    }

    host.move(player.name, next);

    if (!player.isLooping && stepValue(next, 1, range) === next) {
      finish();
    }
  }

  /** Moves a timed run to where its clock says, on the param's grid, and ends or loops it at its end. */
  function runTo(player: LessonPlayer, run: PlaybackRun, now: number): void {
    if (loop.started < 0) {
      loop.started = now;

      return;
    }

    const share = (player.to - loop.start) / (player.to - player.from);
    const progress = Math.min(1, (now - loop.started) / (playbackRuns[run.run] * MS_PER_SECOND * share));
    const travelled = run.isEased === true ? eased(progress) : progress;
    const next = scrubTo(loop.start + (player.to - loop.start) * travelled, host.grid(player)).value;

    if (next !== host.value(player.name)) {
      host.move(player.name, next);
    }

    if (progress < 1) {
      return;
    }

    if (player.isLooping) {
      host.move(player.name, player.from);

      loop.started = now;
      loop.start = player.from;
    } else {
      finish();
    }
  }

  function frame(now: number): void {
    const playing = host.playing();
    const player = playing === null ? undefined : players.get(playing);

    if (player === undefined) {
      finish();

      return;
    }

    if (typeof player.pace !== 'string') {
      runTo(player, player.pace, now);

      return;
    }

    if (loop.last < 0) {
      loop.last = now;

      return;
    }

    loop.budget += ((now - loop.last) / MS_PER_SECOND) * playbackPaces[player.pace];
    loop.last = now;

    const count = Math.floor(loop.budget);

    if (count >= 1) {
      loop.budget -= count;

      advance(player, count);
    }
  }

  function playerOf(name: string | undefined): LessonPlayer {
    const named = name ?? (players.size === 1 ? [...players.keys()][0] : undefined);
    const player = named === undefined ? undefined : players.get(named);
    const known = players.size === 0 ? 'none' : [...players.keys()].join(', ');

    return player ?? host.refuse(`no player for "${named ?? ''}". Players: ${known}. Add a Playback for it.`);
  }

  function play(name?: string, origin?: PlayOrigin): void {
    const player = playerOf(name);

    if (isMotionReduced()) {
      host.move(player.name, player.to);

      return;
    }

    if (host.value(player.name) >= player.to) {
      host.move(player.name, player.from);
    }

    pause(origin);
    host.setPlaying(player.name, origin);

    loop.last = -1;
    loop.budget = 0;
    loop.started = -1;
    loop.start = host.value(player.name);

    const stopFrames = onFrame(frame);

    function onVisibility(): void {
      if (document.visibilityState === 'hidden') {
        finish();
      }
    }

    document.addEventListener('visibilitychange', onVisibility);

    loop.stop = () => {
      stopFrames();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }

  function register(player: LessonPlayer): () => void {
    players.set(player.name, player);
    host.publish(Object.fromEntries(players));

    return () => {
      if (players.get(player.name) !== player) {
        return;
      }

      players.delete(player.name);

      if (host.playing() === player.name) {
        pause();
      }

      host.publish(Object.fromEntries(players));
    };
  }

  return { register, play, pause };
}
