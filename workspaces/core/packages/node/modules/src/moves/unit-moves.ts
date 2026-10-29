import { spellsStem } from '@mechane/program';
import { Array, Option } from 'effect';
import { basename } from 'node:path';
import { TYPESCRIPT_EXTENSION } from '../constants.ts';
import { fileRole } from '../file-role.ts';
import { inScope } from '../in-scope.ts';
import { originKey } from '../origin-key.ts';
import type { FileFacts, Move, PlacementIndex, Unit } from '../types.ts';
import { unitUsers } from '../units/unit-users.ts';
import { pullMove } from './pull-move.ts';
import { pushMove } from './push-move.ts';

/** One round's index, the files whose declarations may move, and every member's source roots. */
type UnitMovesInput = {
  readonly index: PlacementIndex;
  /** Relative to the workspace; every file when they are none. */
  readonly paths: ReadonlyArray<string>;
  readonly roots: ReadonlyArray<string>;
};

/** One round's index, a file's facts, one of its units, and every member's source roots. */
type UnitMoveInput = {
  readonly index: PlacementIndex;
  readonly facts: FileFacts;
  readonly unit: Unit;
  readonly roots: ReadonlyArray<string>;
};

/**
 * Where each unit under `paths` belongs when it is not there: beside its one user, unexported, or in the nearest shared
 * folder's role file. An unexported unit that only other units of its file name has their users and moves with them.
 * Every move stays within its source root, and a unit an entry exports, or a behavior file's own value, stays.
 */
export function unitMoves({ index, paths, roots }: UnitMovesInput): ReadonlyArray<Move> {
  /** Whether a file lies under the paths whose declarations may move. */
  const isPlaced: (facts: FileFacts) => boolean = ({ source }) =>
    inScope({ path: source.path, scope: { paths, excluded: [] } });

  /** The move of each unit of a file that belongs elsewhere. */
  const fileMoves: (facts: FileFacts) => ReadonlyArray<Move> = (facts) =>
    Array.getSomes([...facts.units.values()].map((unit) => unitMove({ index, facts, unit, roots })));

  return [...index.files.values()].filter(isPlaced).flatMap(fileMoves);
}

/** A unit's move beside its one user or to its users' shared folder; none for a pinned unit or a file's own value. */
function unitMove({ index, facts, unit, roots }: UnitMoveInput): Option.Option<Move> {
  const role = fileRole({ path: unit.path });
  const stem = basename(unit.path, TYPESCRIPT_EXTENSION);

  if (index.pinned.has(originKey(unit)) || (Option.isNone(role) && spellsStem({ name: unit.name, stem }))) {
    return Option.none();
  }

  const { users, carriers } = unitUsers({ index, facts, unit, gathering: new Set() });

  if (users.size === 1) {
    return Option.flatMap(Array.head([...users]), (user) => pullMove({ unit, user, role, carriers }));
  }

  return pushMove({ unit, users, roots, carriers });
}
