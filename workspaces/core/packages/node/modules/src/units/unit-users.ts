import { Option } from 'effect';
import { StatementKind } from '../constants.ts';
import { originKey } from '../origin-key.ts';
import { isWithin } from '../references/is-within.ts';
import type { FileFacts, PlacementIndex, Reference, Unit } from '../types.ts';

/** One round's index, a file's facts, one of its units, and the keys of the units whose users are being gathered. */
type UnitUsersInput = {
  readonly index: PlacementIndex;
  readonly facts: FileFacts;
  readonly unit: Unit;
  readonly gathering: ReadonlySet<string>;
};

/** The files that use a unit, and the keys of the units of its file that carry it, none unless only they name it. */
type UnitUsers = { readonly users: ReadonlySet<string>; readonly carriers: ReadonlyArray<string> };

/**
 * The files that use a unit: each file that imports it through any re-export, and its own file where it is named. An
 * unexported unit that only other units of its file name takes their users instead, and they carry it.
 */
export function unitUsers({ index, facts, unit, gathering }: UnitUsersInput): UnitUsers {
  const uses = Option.getOrElse(Option.fromNullishOr(index.uses.get(originKey(unit))), () => []);

  /** Whether the reference names the unit from outside its own statements. */
  const isOutsideUse: (reference: Reference) => boolean = ({ name, offset }) =>
    name === unit.name && !isWithin({ spans: unit.statements, offset });

  const offsets = facts.references.filter(isOutsideUse).map(({ offset }) => offset);

  /** Whether another unit of the file names the unit. */
  const isCarrier: (other: Unit) => boolean = (other) =>
    other !== unit && offsets.some((offset) => isWithin({ spans: other.statements, offset }));

  const carriers = [...facts.units.values()].filter(isCarrier);

  /** Whether a carrier's statements hold the offset. */
  const isInCarrier: (offset: number) => boolean = (offset) =>
    carriers.some((carrier) => isWithin({ spans: carrier.statements, offset }));

  const isExported = Option.exists(Option.fromNullishOr(facts.names.get(unit.name)), (name) => name.isExported);
  const isCarried = !isExported && offsets.length > 0 && offsets.every(isInCarrier);

  if (!isCarried) {
    const importers = uses.filter(({ statement }) => statement.kind === StatementKind.Import).map(({ path }) => path);

    return { users: new Set([...importers, ...[unit.path].filter(() => offsets.length > 0)]), carriers: [] };
  }

  const gathered = new Set([...gathering, originKey(unit)]);

  /** Whether no gathering of the carrier's users is under way. */
  const isUngathered: (carrier: Unit) => boolean = (carrier) => !gathering.has(originKey(carrier));

  /** The users of a carrier, gathered with the unit's key among those under way. */
  const carrierUsers: (carrier: Unit) => ReadonlyArray<string> = (carrier) => [
    ...unitUsers({ index, facts, unit: carrier, gathering: gathered }).users,
  ];

  return {
    users: new Set(carriers.filter(isUngathered).flatMap(carrierUsers)),
    carriers: carriers.map((carrier) => originKey(carrier)),
  };
}
