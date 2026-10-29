import { Option } from 'effect';
import { basename, dirname } from 'node:path';
import { ENTRY_FILE, PROGRAM_FILE } from '../constants.ts';
import { fileRole } from '../file-role.ts';
import type { Move, Unit } from '../types.ts';
import { DECLARATION_FILE } from './constants.ts';
import { leavesFolder } from './leaves-folder.ts';

/** A unit, the one file that uses it, the role its own file names, and the units that carry it. */
type PullMoveInput = {
  readonly unit: Unit;
  readonly user: string;
  /** Absent for a unit of a behavior file. */
  readonly role: Option.Option<string>;
  readonly carriers: ReadonlyArray<string>;
};

type ClosedFileInput = { readonly path: string };

/**
 * The move beside a unit's one user, which no executable, entry or declaration file takes. A role file takes only a
 * unit of its own role, and a located unit moves only within its folder.
 */
export function pullMove({ unit, user, role, carriers }: PullMoveInput): Option.Option<Move> {
  const userRole = fileRole({ path: user });

  if (user === unit.path || isClosedFile({ path: user })) {
    return Option.none();
  }

  const isOtherRole = Option.isSome(userRole) && !Option.contains(role, userRole.value);

  if (isOtherRole || leavesFolder({ unit, folder: dirname(user) })) {
    return Option.none();
  }

  return Option.some({ unit, to: user, isPrivate: true, hasOwnUse: false, carriers });
}

/** Whether a file takes no moved unit: an executable, an entry or a declaration file. */
function isClosedFile({ path }: ClosedFileInput): boolean {
  const file = basename(path);

  return file === PROGRAM_FILE || file === ENTRY_FILE || file.endsWith(DECLARATION_FILE);
}
