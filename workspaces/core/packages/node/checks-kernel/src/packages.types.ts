import type { MoveMap } from './packages.schemas.ts';

/** One move of files of a step, relative to the workspace. */
export type PathMove = MoveStep['moves'][number];

/** One step of the move map. */
export type MoveStep = MoveMap['steps'][number];
