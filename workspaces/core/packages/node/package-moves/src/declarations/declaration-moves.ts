import type { MoveStep } from '@mechane/checks-kernel';
import { unitUsers } from '@mechane/modules';
import type { FileFacts, Move, PlacementIndex, Unit } from '@mechane/modules';
import { Option } from 'effect';

/** One round's index, and one declaration move a step names. */
type DeclarationMovesInput = { readonly index: PlacementIndex; readonly declaration: MoveStep['declarations'][number] };

/** One round's index, a file's facts, the name of one of its declarations, and the file it moves to. */
type NamedMoveInput = {
  readonly index: PlacementIndex;
  readonly facts: FileFacts;
  readonly name: string;
  readonly to: string;
};

/** The moves of a declaration move's names that its file still holds. */
export function declarationMoves({ index, declaration }: DeclarationMovesInput): ReadonlyArray<Move> {
  const { from, to, names } = declaration;

  /** The moves of the names the file still declares. */
  const fileMoves: (facts: FileFacts) => ReadonlyArray<Move> = (facts) => {
    /** The move of one name, none once the file no longer declares it. */
    const nameMoves: (name: string) => ReadonlyArray<Move> = (name) =>
      Option.toArray(namedMove({ index, facts, name, to }));

    return names.flatMap(nameMoves);
  };

  return Option.match(Option.fromNullishOr(index.files.get(from)), { onNone: () => [], onSome: fileMoves });
}

/**
 * The move of one named declaration of a file, exported as it stands, or unexported beside the declarations that alone
 * name it, which the step must move with it.
 */
function namedMove({ index, facts, name, to }: NamedMoveInput): Option.Option<Move> {
  /** The unit's move to the destination. */
  const unitMove: (unit: Unit) => Move = (unit) => {
    const { users, carriers } = unitUsers({ index, facts, unit, gathering: new Set() });

    return { unit, to, isPrivate: carriers.length > 0, hasOwnUse: users.has(unit.path), carriers };
  };

  return Option.map(Option.fromNullishOr(facts.units.get(name)), unitMove);
}
