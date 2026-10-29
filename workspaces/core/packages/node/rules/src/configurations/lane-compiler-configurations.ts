import type { Lane } from '@mechane/rule-shapes';
import { Record } from 'effect';
import { posix } from 'node:path';
import { ConfigurationPath, Syntax } from '../constants.ts';
import { CONTRACTS } from '../contracts.ts';
import type { GeneratedFile, WorkspaceMember } from '../types.ts';
import { configurationText } from './configuration-text.ts';
import { LANE_PROGRAMS, STRICT_GLOBALS, STRICT_GLOBALS_FILE } from './constants.ts';
import { extendedPath } from './extended-path.ts';

/** The folder of the lanes' programs, the workspace itself. */
const WORKSPACE = '';

type LaneCompilerConfigurationsInput = { readonly members: ReadonlyArray<WorkspaceMember> };

/**
 * Each lane's program, `tsconfig.<lane>.json`: the base configuration, the lane runtime's `lib` or `types`, its strict
 * globals, and the source roots of every member `dependencies.json` puts in the lane. The typecheck runs each one.
 */
export function laneCompilerConfigurations({ members }: LaneCompilerConfigurationsInput): ReadonlyArray<GeneratedFile> {
  const laneProgram: (program: readonly [Lane, unknown]) => GeneratedFile = ([lane, compilerOptions]) => {
    const value = {
      extends: extendedPath({ folder: WORKSPACE, program: ConfigurationPath.Compiler }),
      compilerOptions,
      files: [posix.join(STRICT_GLOBALS, lane, STRICT_GLOBALS_FILE)],
      include: members.filter(({ entry }) => entry.lane === lane).flatMap(({ roots }) => roots),
    };

    return {
      path: LANE_PROGRAMS[lane],
      text: configurationText({ value, notes: [], expanded: [[], ['compilerOptions']], syntax: Syntax.Json }),
    };
  };

  return Record.toEntries(CONTRACTS['code-typescript-compiler-strictness'].values.lanePrograms).map(laneProgram);
}
