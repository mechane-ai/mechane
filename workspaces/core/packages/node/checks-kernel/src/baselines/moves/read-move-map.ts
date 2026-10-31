import { Effect, Schema } from 'effect';
import { InputUnreadable } from '../../errors.ts';
import { MoveMap } from '../../packages.schemas.ts';
import { readText } from '../../read-text.ts';

/** Historical package moves retained only to preserve ratchet attribution across older merge bases. */
const MOVE_MAP = 'packages/node/checks-kernel/src/baselines/moves/move-map.json';

/** The committed move map's steps, in the order they apply; a map its schema refuses fails the read. */
export const readMoveMap = Effect.fn('readMoveMap')(function* (): Effect.fn.Return<MoveMap['steps'], InputUnreadable> {
  const { steps } = yield* Schema.decodeUnknownEffect(MoveMap)(yield* readText({ path: MOVE_MAP })).pipe(
    Effect.mapError((error) => new InputUnreadable({ path: MOVE_MAP, reason: error.message })),
  );

  return steps;
});
