import { TYPESCRIPT_EXTENSION } from '@mechane/modules';
import { identifierWords, spellsStem } from '@mechane/program';
import { Array, Option } from 'effect';
import type { ExportedName } from './types.ts';

/** A behavior file's exports, and its stem. */
type ExtraExportsInput = { readonly exported: ReadonlyArray<ExportedName>; readonly stem: string };

/** An export, the file's stem, and the value the stem spells. */
type ExtraTypeInput = {
  readonly entry: ExportedName;
  readonly stem: string;
  /** The value the stem spells, from which a type may derive; absent when no value does. */
  readonly ownValue: Option.Option<ExportedName>;
};

/** An export beyond a behavior file's one value: where its statement starts, and how to move it. */
type ExtraExport = { readonly start: number; readonly message: string };

/** Each export beyond the one value: a value its stem does not spell, or a type neither its stem nor value explains. */
export function extraExports({ exported, stem }: ExtraExportsInput): ReadonlyArray<ExtraExport> {
  /** Whether the export is the value its stem spells. */
  const isOwnValue: (entry: ExportedName) => boolean = ({ name, isType }) => !isType && spellsStem({ name, stem });
  /** Whether the export is a value its stem does not spell. */
  const isOtherValue: (entry: ExportedName) => boolean = ({ name, isType }) => !isType && !spellsStem({ name, stem });
  const ownValue = Array.findFirst(exported, isOwnValue);

  /** The move of a value to its own file, named for it in kebab case, such as `start-stack.ts` for `startStack`. */
  const movedValue: (entry: ExportedName) => ExtraExport = ({ name, start }) => ({
    start,
    message: `Move \`${name}\` to its own file, such as \`${identifierWords({ identifier: name }).join('-')}${TYPESCRIPT_EXTENSION}\``,
  });

  /** The move of a type to a role file. */
  const movedType: (entry: ExportedName) => ExtraExport = ({ name, start }) => ({
    start,
    message: `Move the type \`${name}\` to a role file, such as \`types.ts\``,
  });

  return [
    ...exported.filter(isOtherValue).map(movedValue),
    ...exported.filter((entry) => isExtraType({ entry, stem, ownValue })).map(movedType),
  ];
}

/** A type its stem does not name and that is not derived from the file's value, as `typeof` derives one. */
function isExtraType({ entry, stem, ownValue }: ExtraTypeInput): boolean {
  /** Whether the type's declaration reads the value with `typeof`. */
  const isDerived: (value: ExportedName) => boolean = ({ name }) =>
    new RegExp(`\\btypeof\\s+${name}\\b`).test(entry.declaration);

  return entry.isType && !spellsStem({ name: entry.name, stem }) && !Option.exists(ownValue, isDerived);
}
