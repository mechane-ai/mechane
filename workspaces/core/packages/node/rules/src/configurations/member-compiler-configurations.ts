import { posix } from 'node:path';
import { Syntax } from '../constants.ts';
import type { GeneratedFile, WorkspaceMember } from '../types.ts';
import { configurationText } from './configuration-text.ts';
import { LANE_PROGRAMS } from './constants.ts';
import { extendedPath } from './extended-path.ts';

/** Each member's compiler configuration, beside its manifest. */
const MEMBER_COMPILER_CONFIGURATION = 'tsconfig.json';

type MemberCompilerConfigurationsInput = { readonly members: ReadonlyArray<WorkspaceMember> };

/**
 * Each member's `tsconfig.json`: it extends its lane's program and includes only its own source roots, so an editor
 * checks a member's file as the lane's typecheck does.
 */
export function memberCompilerConfigurations({
  members,
}: MemberCompilerConfigurationsInput): ReadonlyArray<GeneratedFile> {
  const memberConfiguration: (member: WorkspaceMember) => GeneratedFile = ({ folder, roots, entry }) => {
    const value = {
      extends: extendedPath({ folder, program: LANE_PROGRAMS[entry.lane] }),
      include: roots.map((root) => posix.relative(folder, root)),
    };

    return {
      path: posix.join(folder, MEMBER_COMPILER_CONFIGURATION),
      text: configurationText({ value, notes: [], expanded: [[]], syntax: Syntax.Json }),
    };
  };

  return members.map(memberConfiguration);
}
