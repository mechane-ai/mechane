import type { ImportBan, RestrictedRule } from '@mechane/rule-shapes';
import { Array, Record } from 'effect';

type BannedMembersInput = { readonly rule: RestrictedRule };

type BannedImportsInput = { readonly ban: ImportBan };

/** The members a restricted rule bans: each object's properties, then each module or name an import may not take. */
export function bannedMembers({ rule }: BannedMembersInput): string {
  const bannedProperties: (entry: readonly [string, ReadonlyArray<string>]) => ReadonlyArray<string> = ([
    object,
    names,
  ]) => {
    const bannedProperty: (property: string) => string = (property) => `\`${object}.${property}\``;

    return names.map(bannedProperty);
  };

  const properties = Record.toEntries(rule.properties).flatMap(bannedProperties);

  return [...properties, ...rule.imports.flatMap((ban) => bannedImports({ ban }))].join(', ');
}

/** One import ban as the block states it: the module, or each name of it an import may not take. */
function bannedImports({ ban }: BannedImportsInput): ReadonlyArray<string> {
  const wholeModule: () => ReadonlyArray<string> = () => [`\`${ban.module}\``];

  const bannedNames: (names: Array.NonEmptyReadonlyArray<string>) => ReadonlyArray<string> = (names) => {
    const bannedName: (name: string) => string = (name) => `\`${name}\` of \`${ban.module}\``;

    return names.map(bannedName);
  };

  return Array.match(ban.names, { onEmpty: wholeModule, onNonEmpty: bannedNames });
}
