import { movedPath } from '../../moved-path.ts';
import type { MoveStep } from '../../packages.types.ts';

/** The steps a path goes through, and the path before the first of them, relative to the workspace. */
type MappedPathInput = { readonly steps: ReadonlyArray<MoveStep>; readonly path: string };

/** A path after each of the steps, each step moving it from where the steps before it left it. */
export function mappedPath({ steps, path }: MappedPathInput): string {
  let moved = path;

  for (const { moves } of steps) {
    moved = movedPath({ moves, path: moved });
  }

  return moved;
}
