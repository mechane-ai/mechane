import { Lane } from '@mechane/rule-shapes';

/** The folder of each lane's generated strict globals, relative to the workspace, one folder per lane. */
export const STRICT_GLOBALS = 'lint/types';

/** The file of a lane's strict globals in its folder. */
export const STRICT_GLOBALS_FILE = 'strict-globals.d.ts';

/** Each lane's program, relative to the workspace: every member of the lane, under its runtime's types. */
export const LANE_PROGRAMS = {
  [Lane.Shared]: 'tsconfig.shared.json',
  [Lane.Worker]: 'tsconfig.worker.json',
  [Lane.Node]: 'tsconfig.node.json',
} as const;
