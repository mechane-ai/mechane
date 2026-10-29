import { Array, Option } from 'effect';
import { basename, join, sep } from 'node:path';
import { TYPESCRIPT_EXTENSION } from '../constants.ts';
import type { RoleFile } from '../constants.ts';
import { fileRole } from '../file-role.ts';
import type { Move, Unit } from '../types.ts';
import { commonFolder } from './common-folder.ts';
import { leavesFolder } from './leaves-folder.ts';

/** A path, and a folder it may lie below. */
type BelowInput = { readonly path: string; readonly parent: string };

/** A unit, the files that use it, every member's source roots, and the units that carry it. */
type PushMoveInput = {
  readonly unit: Unit;
  readonly users: ReadonlySet<string>;
  readonly roots: ReadonlyArray<string>;
  readonly carriers: ReadonlyArray<string>;
};

/**
 * The move to the role file of the nearest folder that holds every user, above or below the unit's own. It is the
 * unit's own role file, or the one its kind belongs in for a unit of a behavior file. The folder lies within the unit's
 * source root, and a located unit stays in its folder.
 */
export function pushMove({ unit, users, roots, carriers }: PushMoveInput): Option.Option<Move> {
  const folder = commonFolder({ paths: [...users] });
  const ownRole = fileRole({ path: unit.path });

  /** The name of the role file of a role. */
  const roleFileName: (role: RoleFile) => string = (role) => `${role}${TYPESCRIPT_EXTENSION}`;

  const file: Option.Option<string> = (() => {
    if (Option.isSome(ownRole)) {
      return Option.some(basename(unit.path));
    }

    return Option.map(unit.kindRole, roleFileName);
  })();

  /** Whether the path lies below the parent folder. */
  const isBelow: (input: BelowInput) => boolean = ({ path, parent }) => path.startsWith(`${parent}${sep}`);
  /** Whether the unit's file lies below the root. */
  const holdsUnit: (root: string) => boolean = (root) => isBelow({ path: unit.path, parent: root });
  /** Whether the folder is the root or lies below it. */
  const holdsFolder: (root: string) => boolean = (root) => folder === root || isBelow({ path: folder, parent: root });
  const isRooted = Option.exists(Array.findFirst(roots, holdsUnit), holdsFolder);

  if (!isRooted || leavesFolder({ unit, folder }) || Option.isNone(file)) {
    return Option.none();
  }

  const to = join(folder, file.value);

  if (to === unit.path) {
    return Option.none();
  }

  return Option.some({ unit, to, isPrivate: carriers.length > 0, hasOwnUse: users.has(unit.path), carriers });
}
