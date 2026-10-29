import { Array, Option } from 'effect';
import { originKey } from '../origin-key.ts';
import type { FileFacts, Move, Need, PlacementIndex } from '../types.ts';
import { importBinding } from './import-binding.ts';
import { importForm } from './import-form.ts';

type UnitNeedsInput = { readonly index: PlacementIndex; readonly move: Move };

type NeedOfInput = {
  readonly index: PlacementIndex;
  readonly move: Move;
  readonly facts: FileFacts;
  readonly name: string;
};

/**
 * Each name a moving unit uses from its file, with the binding its destination needs for it. The destination imports a
 * name the file declares from the file, and a name the file imports from the same module. A global needs nothing.
 */
export function unitNeeds({ index, move }: UnitNeedsInput): ReadonlyArray<Need> {
  const used = [...new Set(move.unit.references.map(({ name }) => name))];
  const facts = Option.fromNullishOr(index.files.get(move.unit.path));

  if (Option.isNone(facts)) {
    return [];
  }

  return Array.getSomes(used.map((name) => needOf({ index, move, facts: facts.value, name })));
}

/** What a name the unit uses needs at its destination; none for a global, which its file neither declares nor takes. */
function needOf({ index, move, facts, name }: NeedOfInput): Option.Option<Need> {
  const path = facts.source.path;
  const isValueUse = move.unit.references.some((reference) => reference.name === name && !reference.isType);
  const declared = Option.fromNullishOr(facts.names.get(name));

  if (Option.isSome(declared)) {
    return Option.some({
      local: name,
      origin: originKey({ path, name }),
      declared,
      isTypeOnly: declared.value.isTypeOnly || !isValueUse,
      form: importForm({ move, specifier: path, target: Option.some(path), name: { imported: name, local: name } }),
    });
  }

  const binding = importBinding({ index, facts, name });

  if (Option.isNone(binding)) {
    return Option.none();
  }

  const { statement, name: taken, key } = binding.value;

  return Option.some({
    local: name,
    origin: key,
    declared: Option.none(),
    isTypeOnly: statement.isTypeOnly || !isValueUse,
    form: importForm({ move, specifier: statement.specifier, target: statement.target, name: taken }),
  });
}
