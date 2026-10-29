import type { FileChange } from '@mechane/checks-kernel';
import { editedText, lineEnd, statementEdits } from '@mechane/modules';
import type { FileFacts, ParsedSource, TextEdit } from '@mechane/modules';
import { Option } from 'effect';
import { parseSync } from 'oxc-parser';
import type { FileRewrite, Insertion } from './types.ts';

/** A file that a round rewrites, its facts, and its rewrite. */
type RewrittenFileInput = {
  readonly path: string;
  /** Absent for a role file the round creates. */
  readonly facts: Option.Option<FileFacts>;
  readonly rewrite: FileRewrite;
};

/** A file's text, the offset after its last import or re-export, and the declarations that land there. */
type InsertionEditInput = { readonly text: string; readonly offset: number; readonly texts: ReadonlyArray<string> };

/**
 * A file's change: its text after the round, or none for a file the round empties. A role file a push creates starts
 * empty and gains the unit with its imports.
 */
export function rewrittenFile({ path, facts, rewrite }: RewrittenFileInput): FileChange {
  /** The empty file a push creates. */
  const createdSource: () => ParsedSource = () => ({
    path,
    text: '',
    parsed: parseSync(path, '', { sourceType: 'module', lang: 'ts' }),
  });

  const source = Option.getOrElse(
    Option.map(facts, (file) => file.source),
    createdSource,
  );

  const landings = Map.groupBy(rewrite.inserted, ({ offset }) => offset);

  /** The edit that lands one offset's declarations. */
  const landingEdit: (group: readonly [number, ReadonlyArray<Insertion>]) => ReadonlyArray<TextEdit> = ([
    offset,
    group,
  ]) => insertionEdit({ text: source.text, offset, texts: group.map(({ text }) => text) });

  const edits: ReadonlyArray<TextEdit> = [
    ...statementEdits({ source, rewrite }),
    ...rewrite.removed.map(({ start, end }) => ({ start, end, text: '' })),
    ...[...landings].flatMap(landingEdit),
  ];

  const text = editedText({ text: source.text, edits });

  /** Whether the text holds more than white space. */
  const isWritten: (written: string) => boolean = (written) => written.trim() !== '';

  return { path, text: Option.liftPredicate(text, isWritten) };
}

/**
 * Where moved declarations land, set apart by blank lines: on the line after their offset, which closes the last import
 * or the last declaration they name. In a file without either, they land at the top.
 */
function insertionEdit({ text, offset, texts }: InsertionEditInput): ReadonlyArray<TextEdit> {
  const declarations = texts.join('\n\n');

  if (offset > 0) {
    const start = lineEnd({ text, offset });

    return [{ start, end: start, text: `\n${declarations}\n` }];
  }

  if (text === '') {
    return [{ start: 0, end: 0, text: `${declarations}\n` }];
  }

  return [{ start: 0, end: 0, text: `${declarations}\n\n` }];
}
