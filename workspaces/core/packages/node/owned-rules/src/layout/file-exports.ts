import type { ParsedSource } from '@mechane/modules';
import { Array, Option } from 'effect';
import { Visitor } from 'oxc-parser';
import type { ExportDefaultDeclaration } from 'oxc-parser';

type FileExportsInput = { readonly source: ParsedSource };

/** The names a module exports, and whether it has a default export, which the runtime that loads it names. */
type FileExports = { readonly names: ReadonlyArray<string>; readonly hasDefault: boolean };

/** The names a module exports, and whether it has a default export. */
export function fileExports({ source }: FileExportsInput): FileExports {
  const { program, module } = source.parsed;
  const entries = module.staticExports.flatMap((statement) => statement.entries);
  const names = Array.getSomes(entries.map((entry) => Option.fromNullishOr(entry.exportName.name)));
  const defaults: Array<ExportDefaultDeclaration> = [];

  /** Keeps a default export. */
  const keepDefault: (node: ExportDefaultDeclaration) => void = (node) => {
    defaults.push(node);
  };

  new Visitor({ ExportDefaultDeclaration: keepDefault }).visit(program);

  return { names, hasDefault: defaults.length > 0 };
}
