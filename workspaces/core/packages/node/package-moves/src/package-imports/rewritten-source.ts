import { movedPath } from '@mechane/checks-kernel';
import type { ParsedSource } from '@mechane/modules';
import { editedText, moduleStatements, statementEdits } from '@mechane/modules';
import type { RewrittenSource } from '../packages.types.ts';
import { literalEdits } from './literal-edits.ts';
import { statementRewrite } from './statement-rewrite.ts';
import type { SourceContext } from './types.ts';

/** The context of a file's rewrite and the file before the step. */
type SourceInput = { readonly context: SourceContext; readonly source: ParsedSource };

/** A file after the step, and each import of it that a literal path cannot name across members. */
type RewrittenFile = { readonly source: RewrittenSource; readonly crossings: ReadonlyArray<string> };

/**
 * A TypeScript file as the step leaves it, at its new path. Each named statement takes each name from where it lands,
 * and each other relative path names what it named. With it come the names it takes from other entries, and each import
 * that a literal path cannot make across members.
 */
export function rewrittenSource({ context, source }: SourceInput): RewrittenFile {
  const statements = moduleStatements({ source });
  const rewrites = statements.map((statement) => statementRewrite({ context, importer: source.path, statement }));
  const literal = literalEdits({ context, source, named: new Set(statements.map(({ start }) => start)) });

  const rewrite = {
    dropped: rewrites.flatMap(({ dropped }) => dropped),
    added: rewrites.flatMap(({ added }) => added),
  };

  const edits = [...statementEdits({ source, rewrite }), ...literal.edits];
  const path = movedPath({ moves: context.layout.moves, path: source.path });
  const text = editedText({ text: source.text, edits });

  return {
    source: {
      from: source.path,
      path,
      text,
      isChanged: path !== source.path || text !== source.text,
      requirements: rewrites.flatMap(({ requirements }) => requirements),
    },
    crossings: literal.crossings,
  };
}
