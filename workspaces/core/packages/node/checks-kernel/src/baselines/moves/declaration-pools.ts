import { Effect } from 'effect';
import type { InputUnreadable } from '../../errors.ts';
import type { MoveStep } from '../../packages.types.ts';
import { joinedPools } from './joined-pools.ts';
import { mappedPath } from './mapped-path.ts';
import { readMoveMap } from './read-move-map.ts';

/** The files of one declaration move, each at its path before its step and after every step. */
type MoveFiles = ReadonlyArray<string>;

/** One step of the map, and the steps from it to the last, which take each of its paths to where it ends. */
type StepFilesInput = { readonly step: MoveStep; readonly later: ReadonlyArray<MoveStep> };

/**
 * The pools of files that the move map's declaration moves join, each file at its path before its step and after every
 * step. A pool holds a ratchet's sites in total, since a moved declaration takes its sites from one file to another.
 */
export const declarationPools = Effect.fn('declarationPools')(function* (): Effect.fn.Return<
  ReadonlyArray<ReadonlySet<string>>,
  InputUnreadable
> {
  const steps = yield* readMoveMap();

  const laterFiles: (step: MoveStep, index: number) => ReadonlyArray<MoveFiles> = (step, index) =>
    stepFiles({ step, later: steps.slice(index) });

  return joinedPools({ groups: steps.flatMap(laterFiles) });
});

/** The files of each declaration move of a step, at their paths before it and after the last step. */
function stepFiles({ step, later }: StepFilesInput): ReadonlyArray<MoveFiles> {
  const moveFiles: (declaration: MoveStep['declarations'][number]) => MoveFiles = ({ from, to }) => [
    from,
    to,
    mappedPath({ steps: later, path: from }),
    mappedPath({ steps: later, path: to }),
  ];

  return step.declarations.map(moveFiles);
}
