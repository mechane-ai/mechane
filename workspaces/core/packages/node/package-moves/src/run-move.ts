import { MOVE_MAP, readMoveMap } from '@mechane/checks-kernel';
import { Array, Effect, Option } from 'effect';
import { applyStep } from './apply-step.ts';
import { MoveRefused } from './errors.ts';
import { loadMoveSettings } from './load-move-settings.ts';
import type { MoveFailure } from './types.ts';

/**
 * Applies each step of the move map through the one the command line names, in the map's order, so a branch cut before
 * a step replays it. Each step skips what it finds done.
 */
export const runMove = Effect.fn('runMove')(function* (): Effect.fn.Return<void, MoveFailure> {
  const { step, inherited } = yield* loadMoveSettings();
  const steps = yield* readMoveMap();
  const position = Array.findFirstIndex(steps, ({ name }) => name === step);

  if (Option.isNone(position)) {
    const names = steps.map(({ name }) => name).join(', ');

    return yield* new MoveRefused({ path: MOVE_MAP, reason: `name one of its steps, ${names}, not ${step}` });
  }

  yield* Effect.forEach(steps.slice(0, position.value + 1), (each) => applyStep({ step: each, inherited }), {
    concurrency: 1,
    discard: true,
  });
});
