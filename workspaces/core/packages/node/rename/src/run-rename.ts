import { Effect, Option } from 'effect';
import { applyMap } from './apply-map.ts';
import { bindingMap } from './binding/binding-map.ts';
import { loadRenameSettings } from './load-rename-settings.ts';
import { readMaps } from './read-maps.ts';
import type { RenameFailure } from './types.ts';

/** Renames the binding the command line names, or applies every committed map in the order of their names. */
export const runRename = Effect.fn('runRename')(function* (): Effect.fn.Return<void, RenameFailure> {
  const { binding } = yield* loadRenameSettings();

  if (Option.isSome(binding)) {
    return yield* applyMap({ map: yield* bindingMap({ binding: binding.value }) });
  }

  const maps = yield* readMaps();

  yield* Effect.forEach(maps, (map) => applyMap({ map }), { concurrency: 1, discard: true });
});
