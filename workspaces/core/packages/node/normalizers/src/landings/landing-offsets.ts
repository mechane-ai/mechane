import type { FileFacts, Unit } from '@mechane/modules';
import { Array, Option } from 'effect';
import type { Landing } from '../types.ts';
import { dependencyOrder } from './dependency-order.ts';
import type { LandingOrder } from './types.ts';
import { valueNames } from './value-names.ts';

/**
 * A unit of the file units land in: its name, the names it reads as values, and the offsets where its first statement
 * starts and its last one closes.
 */
type PlacedUnit = {
  readonly name: string;
  readonly names: ReadonlySet<string>;
  readonly first: number;
  readonly close: number;
};

/** The file units land in, and the units. */
type LandingOffsetsInput = {
  /** Absent for a role file the round creates. */
  readonly facts: Option.Option<FileFacts>;
  readonly units: ReadonlyArray<Unit>;
};

/** The landing units in order, the file's own units, and the offset after its imports. */
type LandingsInput = {
  readonly ordered: LandingOrder;
  readonly placed: ReadonlyArray<PlacedUnit>;
  readonly start: number;
};

/**
 * Where each unit landing in one file goes, in the order they land, since a constant or a class read before its
 * declaration throws. A value unit lands after each declaration and landing unit it names, and before each declaration
 * that names it. A type lands after the imports, or at the start of a file the round creates.
 */
export function landingOffsets({ facts, units }: LandingOffsetsInput): ReadonlyArray<Landing> {
  const present: ReadonlyMap<string, Unit> = Option.match(facts, {
    onNone: () => new Map(),
    onSome: (file) => file.units,
  });

  /** A unit of the file, with the names it reads and where it starts and closes. */
  const placedUnit: (unit: Unit) => PlacedUnit = (unit) => ({
    name: unit.name,
    names: valueNames({ unit }),
    first: Math.min(...unit.statements.map(({ start }) => start)),
    close: Math.max(...unit.statements.map(({ start, text }) => start + text.length)),
  });

  return landings({
    ordered: dependencyOrder({ units }),
    placed: [...present.values()].map(placedUnit),
    start: Option.match(facts, { onNone: () => 0, onSome: ({ insertion }) => insertion }),
  });
}

/**
 * Each unit with its offset: the latest of the start, the close of each declaration it names and the offset of each
 * landing unit it names. The offset keeps it in order when no declaration that names it starts above it.
 */
function landings({ ordered, placed, start }: LandingsInput): ReadonlyArray<Landing> {
  /** The landings so far, then the unit's own. */
  const landAfter: (landed: ReadonlyArray<Landing>, unit: Unit) => ReadonlyArray<Landing> = (landed, unit) => {
    const named = valueNames({ unit });

    const offset = Math.max(
      start,
      ...placed.filter(({ name }) => named.has(name)).map(({ close }) => close),
      ...landed.filter((earlier) => named.has(earlier.unit.name)).map((earlier) => earlier.offset),
    );

    /** Whether a declaration of the file names the unit and starts above its offset. */
    const isNamingAbove: (declaration: PlacedUnit) => boolean = ({ names, first }) =>
      names.has(unit.name) && first < offset;

    const isNamedAbove = placed.some(isNamingAbove);

    return [...landed, { unit, offset, isOrdered: !isNamedAbove && !ordered.cyclic.has(unit.name) }];
  };

  return Array.reduce(ordered.units, Array.empty<Landing>(), landAfter);
}
