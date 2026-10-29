import type { ModuleName, ModuleStatement } from '@mechane/modules';
import { relativeSpecifier } from '@mechane/program';
import { Option } from 'effect';
import { namePlace } from './name-place.ts';
import type { Destination, NamePlace, SourceContext } from './types.ts';

/** The context of a file's rewrite, the file's path before the step, one of its statements, and a name it takes. */
type NameInput = {
  readonly context: SourceContext;
  readonly importer: string;
  readonly statement: ModuleStatement;
  readonly name: ModuleName;
};

/** A statement, a name it takes, and where the name stands after the step. */
type PlacedInput = { readonly statement: ModuleStatement; readonly name: ModuleName; readonly place: NamePlace };

/**
 * Where a name a statement takes comes from after the step; none for an entry's re-export of a file that left its
 * member, which that member's entry exports now. A file of the importer's own member is imported by a relative path,
 * and another member's name by the member's package, whose entry exports it.
 */
export function nameDestination({ context, importer, statement, name }: NameInput): Option.Option<Destination> {
  /** The workspace file of the entry the statement's package specifier names. */
  const entryTarget: () => Option.Option<string> = () => Option.fromNullishOr(context.entries.get(statement.specifier));
  const target = Option.orElse(statement.target, entryTarget);

  /** A package's name, which the statement keeps taking as it does. */
  const packageDestination: () => Option.Option<Destination> = () =>
    Option.some({ specifier: statement.specifier, name, requirement: Option.none() });

  /** A workspace file's name, from where it stands after the step. */
  const fileDestination: (path: string) => Option.Option<Destination> = (path) =>
    placedDestination({ statement, name, place: namePlace({ context, importer, statement, name, target: path }) });

  return Option.match(target, { onNone: packageDestination, onSome: fileDestination });
}

/** A name's destination by where it stands: its own member's file, the package it named, or another member's entry. */
function placedDestination({ statement, name, place }: PlacedInput): Option.Option<Destination> {
  const local = { name, requirement: Option.none() };

  if (place.isLocal) {
    return Option.some({ ...local, specifier: relativeSpecifier({ importer: place.importer, target: place.target }) });
  }

  if (place.owner === place.importing) {
    const specifier = relativeSpecifier({ importer: place.importer, target: place.declaring });

    return Option.some({
      specifier,
      name: { imported: place.origin.name, local: name.local },
      requirement: Option.none(),
    });
  }

  if (place.isStaying) {
    return Option.some({ ...local, specifier: statement.specifier });
  }

  if (place.isDropped) {
    return Option.none();
  }

  const { owner, declaring, origin } = place;
  const requirement = { member: owner, path: declaring, name: origin.name, exported: name.imported };

  return Option.some({
    specifier: owner.name,
    name,
    requirement: Option.some({ ...requirement, isTypeOnly: statement.isTypeOnly }),
  });
}
