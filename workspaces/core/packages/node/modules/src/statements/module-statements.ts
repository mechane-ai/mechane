import { Array, Option } from 'effect';
import type { Statement } from 'oxc-parser';
import { NodeType } from '../constants.ts';
import type { ModuleStatement, ParsedSource } from '../types.ts';
import { importStatement } from './import-statement.ts';
import { reexportStatement } from './reexport-statement.ts';

type ModuleStatementsInput = { readonly source: ParsedSource };

type ModuleStatementInput = { readonly source: ParsedSource; readonly statement: Statement };

/**
 * Each import and re-export statement of the file that takes only named bindings, in the order they stand. A statement
 * that also takes a default or a namespace never changes, so a normalizer leaves it out.
 */
export function moduleStatements({ source }: ModuleStatementsInput): ReadonlyArray<ModuleStatement> {
  return Array.getSomes(source.parsed.program.body.map((statement) => moduleStatement({ source, statement })));
}

/** A top-level statement as an import or a re-export; none for any other statement. */
function moduleStatement({ source, statement }: ModuleStatementInput): Option.Option<ModuleStatement> {
  if (statement.type === NodeType.ImportDeclaration) {
    return importStatement({ source, statement });
  }

  if (statement.type === NodeType.ExportNamedDeclaration) {
    return reexportStatement({ source, statement });
  }

  return Option.none();
}
