import { Option } from 'effect';
import type { ExportNamedDeclaration, ExportSpecifier } from 'oxc-parser';
import { StatementKind } from '../constants.ts';
import type { ModuleName, ModuleStatement, ParsedSource } from '../types.ts';
import { ModuleKind } from './constants.ts';
import { moduleName } from './module-name.ts';
import { resolvedPath } from './resolved-path.ts';

type ReexportStatementInput = { readonly source: ParsedSource; readonly statement: ExportNamedDeclaration };

/** A re-export statement; none for an export that declares or lists the file's own bindings. */
export function reexportStatement({ source, statement }: ReexportStatementInput): Option.Option<ModuleStatement> {
  const from = Option.fromNullishOr(statement.source);

  if (Option.isNone(from) || statement.specifiers.length === 0) {
    return Option.none();
  }

  const specifier = from.value.value;

  /** The name a specifier takes from its module, and the name it exports it as. */
  const reexportedName: (exported: ExportSpecifier) => ModuleName = ({ local, exported }) => ({
    imported: moduleName({ node: local }),
    local: moduleName({ node: exported }),
  });

  return Option.some({
    start: statement.start,
    end: statement.end,
    kind: StatementKind.Reexport,
    isTypeOnly: statement.exportKind === ModuleKind.Type,
    specifier,
    target: resolvedPath({ importer: source.path, specifier }),
    names: statement.specifiers.map(reexportedName),
  });
}
