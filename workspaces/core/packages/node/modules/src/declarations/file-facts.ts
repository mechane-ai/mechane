import { Array, Option } from 'effect';
import type { Statement } from 'oxc-parser';
import { NodeType, StatementKind } from '../constants.ts';
import { locatedOffsets } from '../references/located-offsets.ts';
import { referenceSites } from '../references/reference-sites.ts';
import { moduleStatements } from '../statements/module-statements.ts';
import type { FileFacts, ModuleStatement, ParsedSource } from '../types.ts';
import { topLevel } from './top-level.ts';

type FileFactsInput = { readonly source: ParsedSource };

type ModuleNodeInput = { readonly statement: Statement };

/** What a round reads of one file: its statements, names, units and references, and where moved declarations land. */
export function fileFacts({ source }: FileFactsInput): FileFacts {
  const statements = moduleStatements({ source });
  const modules = source.parsed.program.body.filter((statement) => isModuleNode({ statement }));
  const references = referenceSites({ source, modules });

  /** The names a statement binds in the file. */
  const localNames: (statement: ModuleStatement) => ReadonlyArray<string> = ({ names }) =>
    names.map(({ local }) => local);

  const imported: ReadonlySet<string> = new Set(
    statements.filter(({ kind }) => kind === StatementKind.Import).flatMap(localNames),
  );

  const located = locatedOffsets({ program: source.parsed.program });
  const { names, units } = topLevel({ source, references, imported, located });

  return {
    source,
    statements,
    names,
    units,
    references,
    insertion: Option.match(Array.last(modules), { onNone: () => 0, onSome: ({ end }) => end }),
  };
}

/** Whether a top-level statement is an import or a re-export, which a file's moved declarations follow. */
function isModuleNode({ statement }: ModuleNodeInput): boolean {
  return (
    statement.type === NodeType.ImportDeclaration ||
    (statement.type === NodeType.ExportNamedDeclaration && Option.isSome(Option.fromNullishOr(statement.source)))
  );
}
