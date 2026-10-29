import { importBinding, originKey } from '@mechane/modules';
import type { AddedStatement, DroppedName, FileFacts, Move, Need, PlacementIndex } from '@mechane/modules';
import { Array, Option } from 'effect';

/** The names a file's statements drop, and the statements it adds. */
type ImportChanges = { readonly dropped: ReadonlyArray<DroppedName>; readonly added: ReadonlyArray<AddedStatement> };

/** One round's index, a file's facts, and the units landing in it with their needs. */
type NeededImportsInput = {
  readonly index: PlacementIndex;
  /** Absent for a role file the round creates. */
  readonly facts: Option.Option<FileFacts>;
  readonly needs: ReadonlyArray<Need>;
  readonly incoming: ReadonlyArray<Move>;
};

/** One round's index, a file's facts, a name and every need of it there. */
type NeedImportInput = {
  readonly index: PlacementIndex;
  /** Absent for a role file the round creates. */
  readonly facts: Option.Option<FileFacts>;
  readonly local: string;
  readonly group: ReadonlyArray<Need>;
};

/**
 * The imports a file needs for the units landing in it, one per name. A name the file or a landing unit declares needs
 * none. A name any use takes as a value needs a value import, which replaces a type-only one.
 */
export function neededImports({ index, facts, needs, incoming }: NeededImportsInput): ImportChanges {
  const landing: ReadonlySet<string> = new Set(incoming.map(({ unit }) => originKey(unit)));

  /** Whether neither a landing unit nor the file declares what the need binds. */
  const isOpen: (need: Need) => boolean = ({ local, origin }) =>
    !landing.has(origin) && !Option.exists(facts, ({ names }) => names.has(local));

  const open = needs.filter(isOpen);

  const changes = [...Map.groupBy(open, ({ local }) => local)].map(([local, group]) =>
    needImport({ index, facts, local, group }),
  );

  return { dropped: changes.flatMap(({ dropped }) => dropped), added: changes.flatMap(({ added }) => added) };
}

/** The import one name needs, which replaces a type-only import of it where a use takes it as a value. */
function needImport({ index, facts, local, group }: NeedImportInput): ImportChanges {
  const isTypeOnly = group.every((need) => need.isTypeOnly);
  const bound = Option.flatMap(facts, (file) => importBinding({ index, facts: file, name: local }));
  /** The need's value import, as type-only as every need of the name. */
  const addedImport: (need: Need) => AddedStatement = ({ form }) => ({ ...form, isTypeOnly, anchor: Option.none() });
  const added = Option.toArray(Array.head(group)).map(addedImport);

  if (Option.isNone(bound)) {
    return { dropped: [], added };
  }

  if (!bound.value.statement.isTypeOnly || isTypeOnly) {
    return { dropped: [], added: [] };
  }

  return { dropped: [{ start: bound.value.statement.start, local }], added };
}
