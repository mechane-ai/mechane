import { Option } from 'effect';
import type { ImportDeclaration, ImportDeclarationSpecifier } from 'oxc-parser';
import { NodeType, StatementKind } from '../constants.ts';
import type { ModuleName, ModuleStatement, ParsedSource } from '../types.ts';
import { ModuleKind } from './constants.ts';
import { moduleName } from './module-name.ts';
import { resolvedPath } from './resolved-path.ts';

type ImportStatementInput = { readonly source: ParsedSource; readonly statement: ImportDeclaration };

type NamedImportInput = { readonly specifier: ImportDeclarationSpecifier };

/** An import statement that takes only named bindings; none when it also takes a default or a namespace. */
export function importStatement({ source, statement }: ImportStatementInput): Option.Option<ModuleStatement> {
  const names = statement.specifiers.flatMap((specifier) => namedImport({ specifier }));

  if (names.length === 0 || names.length !== statement.specifiers.length) {
    return Option.none();
  }

  return Option.some({
    start: statement.start,
    end: statement.end,
    kind: StatementKind.Import,
    isTypeOnly: statement.importKind === ModuleKind.Type,
    specifier: statement.source.value,
    target: resolvedPath({ importer: source.path, specifier: statement.source.value }),
    names,
  });
}

/** An import specifier's names; none for a default or a namespace binding. */
function namedImport({ specifier }: NamedImportInput): ReadonlyArray<ModuleName> {
  if (specifier.type !== NodeType.ImportSpecifier) {
    return [];
  }

  return [{ imported: moduleName({ node: specifier.imported }), local: specifier.local.name }];
}
