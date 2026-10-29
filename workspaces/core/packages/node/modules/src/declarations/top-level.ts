import { Array } from 'effect';
import { declaredNames } from '../statements/declared-names.ts';
import type { ParsedSource, Reference, TopLevelDeclaration, TopLevelName, Unit } from '../types.ts';
import { unitOf } from '../units/unit-of.ts';
import { isMovable } from './is-movable.ts';
import { isTypeDeclaration } from './is-type-declaration.ts';
import { topLevelDeclaration } from './top-level-declaration.ts';

/** A file's declared names, and its units by name. */
type TopLevel = { readonly names: ReadonlyMap<string, TopLevelName>; readonly units: ReadonlyMap<string, Unit> };

/** A file, its references, the names it imports, which no unit of it may take, and its located expressions' offsets. */
type TopLevelInput = {
  readonly source: ParsedSource;
  readonly references: ReadonlyArray<Reference>;
  readonly imported: ReadonlySet<string>;
  readonly located: ReadonlyArray<number>;
};

/** A name a declaration binds, and the declaration. */
type NamedEntry = { readonly name: string; readonly entry: TopLevelDeclaration };

/** A name, and the file's top-level declarations of it. */
type NameEntries = { readonly name: string; readonly entries: ReadonlyArray<TopLevelDeclaration> };

type TopLevelNameInput = { readonly entries: ReadonlyArray<TopLevelDeclaration> };

/**
 * A file's top-level declarations: each name it declares, and the units of the names that may move. A unit holds a
 * constant or a class, a type or an interface, or such a pair under one name, which the file does not also import.
 */
export function topLevel({ source, references, imported, located }: TopLevelInput): TopLevel {
  const declarations = Array.getSomes(
    source.parsed.program.body.map((statement) => topLevelDeclaration({ statement })),
  );

  /** Each name a declaration binds, with the declaration. */
  const namedEntries: (entry: TopLevelDeclaration) => ReadonlyArray<NamedEntry> = (entry) =>
    declaredNames({ declaration: entry.declaration }).map((name) => ({ name, entry }));

  /** A name with every declaration of it. */
  const nameEntries: (group: readonly [string, ReadonlyArray<NamedEntry>]) => NameEntries = ([name, group]) => ({
    name,
    entries: group.map(({ entry }) => entry),
  });

  const byName = [...Map.groupBy(declarations.flatMap(namedEntries), ({ name }) => name)].map(nameEntries);

  /** Whether a name may move: the file does not import it, and each of its declarations is movable. */
  const isMovableName: (named: NameEntries) => boolean = ({ name, entries }) =>
    !imported.has(name) && entries.every(({ declaration }) => isMovable({ declaration }));

  /** A name's entry in the file's declared names. */
  const nameEntry: (named: NameEntries) => readonly [string, TopLevelName] = ({ name, entries }) => [
    name,
    topLevelName({ entries }),
  ];

  /** A movable name's unit, under its name. */
  const unitEntry: (named: NameEntries) => readonly [string, Unit] = ({ name, entries }) => [
    name,
    unitOf({ name, entries, source, references, located }),
  ];

  return { names: new Map(byName.map(nameEntry)), units: new Map(byName.filter(isMovableName).map(unitEntry)) };
}

/** Whether a name is exported, whether a value of it is, and whether it names types alone. */
function topLevelName({ entries }: TopLevelNameInput): TopLevelName {
  /** Whether the entry exports a value. */
  const isExportedValue: (entry: TopLevelDeclaration) => boolean = ({ declaration, isExported }) =>
    isExported && !isTypeDeclaration({ declaration });

  return {
    isExported: entries.some(({ isExported }) => isExported),
    isValueExported: entries.some(isExportedValue),
    isTypeOnly: entries.every(({ declaration }) => isTypeDeclaration({ declaration })),
  };
}
