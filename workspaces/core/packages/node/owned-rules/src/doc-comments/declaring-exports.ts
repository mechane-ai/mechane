import type { ParsedSource } from '@mechane/modules';
import type { StaticExport } from 'oxc-parser';

/** An export statement that declares what it exports, rather than listing bindings declared elsewhere. */
const DECLARING_EXPORT =
  /^export\s+(declare\s+)?(async\s+)?(abstract\s+)?(const|let|function|class|type|interface|enum)\b/;

type DeclaringExportsInput = { readonly source: ParsedSource };

/** The export statements of a file that declare what they export, such as `export const` or `export type`. */
export function declaringExports({ source }: DeclaringExportsInput): ReadonlyArray<StaticExport> {
  /** Whether the statement declares what it exports. */
  const isDeclaring: (statement: StaticExport) => boolean = ({ start, end }) =>
    DECLARING_EXPORT.test(source.text.slice(start, end));

  return source.parsed.module.staticExports.filter(isDeclaring);
}
