import type { ImportBan, RestrictedRule } from '@mechane/rule-shapes';
import { Array } from 'effect';
import { propertyEntries } from './property-entries.ts';
import type { RestrictedProperty } from './types.ts';

/** A module no import may name, and the message that teaches the fix. */
type RestrictedModule = { readonly name: string; readonly message: string };

/** The names no import of a module may give, and the message that teaches the fix. */
type RestrictedNames = { readonly name: string; readonly importNames: ReadonlyArray<string>; readonly message: string };

/** An entry of `no-restricted-imports`: a banned module, or the names it may not give. */
type RestrictedImport = RestrictedModule | RestrictedNames;

/** The entries restricted rules give oxlint: the banned imports, and the banned properties of each object. */
type RestrictedEntries = {
  readonly imports: ReadonlyArray<RestrictedImport>;
  readonly properties: ReadonlyArray<RestrictedProperty>;
};

type RestrictedEntriesInput = { readonly rules: ReadonlyArray<RestrictedRule> };

type ImportEntryInput = { readonly ban: ImportBan; readonly message: string };

/**
 * The entries of oxlint's `no-restricted-imports` and `no-restricted-properties` that restricted rules declare, each
 * message ending with the rule of the standard that a finding counts under, such as `(EF-02)`.
 */
export function restrictedEntries({ rules }: RestrictedEntriesInput): RestrictedEntries {
  const ruleImports: (rule: RestrictedRule) => ReadonlyArray<RestrictedImport> = (rule) => {
    const message = `${rule.message} (${rule.standard})`;

    return rule.imports.map((ban) => importEntry({ ban, message }));
  };

  return { imports: rules.flatMap(ruleImports), properties: rules.flatMap((rule) => propertyEntries({ rule })) };
}

/** One banned import: the module and its message, with the names it may not give when the ban lists some. */
function importEntry({ ban, message }: ImportEntryInput): RestrictedImport {
  return Array.match(ban.names, {
    onEmpty: () => ({ name: ban.module, message }),
    onNonEmpty: (importNames) => ({ name: ban.module, importNames, message }),
  });
}
