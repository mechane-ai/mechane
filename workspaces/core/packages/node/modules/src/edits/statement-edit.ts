import { Array, Option } from 'effect';
import { lineEnd } from '../line-end.ts';
import type { ModuleName, ModuleStatement, StatementForm, TextEdit } from '../types.ts';
import { droppedNameKey } from './dropped-name-key.ts';
import { formsText } from './forms-text.ts';
import { uniqueNames } from './unique-names.ts';

/**
 * A file's text and one of its statements, the dropped names of every statement by their keys, the names the statement
 * absorbs, and the statements that land after it.
 */
type StatementEditInput = {
  readonly text: string;
  readonly statement: ModuleStatement;
  readonly dropped: ReadonlySet<string>;
  readonly absorbed: ReadonlyArray<ModuleName>;
  readonly placed: ReadonlyArray<StatementForm>;
};

/** A statement's edit; none when the rewrite neither drops nor brings a name of it, nor lands a statement after it. */
export function statementEdit({
  text,
  statement,
  dropped,
  absorbed,
  placed,
}: StatementEditInput): Option.Option<TextEdit> {
  /** Whether the rewrite keeps a name the statement takes. */
  const isKept: (name: ModuleName) => boolean = ({ local }) =>
    !dropped.has(droppedNameKey({ start: statement.start, local }));

  const kept = statement.names.filter(isKept);
  const present: ReadonlySet<string> = new Set(kept.map(({ local }) => local));

  /** Whether the statement does not take the name yet. */
  const isAbsent: (name: ModuleName) => boolean = ({ local }) => !present.has(local);
  const brought = uniqueNames({ names: absorbed.filter(isAbsent) });

  if (kept.length === statement.names.length && brought.length === 0 && placed.length === 0) {
    return Option.none();
  }

  const names = [...kept, ...brought];
  const forms = [...Array.match(names, { onEmpty: () => [], onNonEmpty: () => [{ ...statement, names }] }), ...placed];

  if (forms.length === 0) {
    return Option.some({ start: statement.start, end: lineEnd({ text, offset: statement.end }), text: '' });
  }

  return Option.some({ start: statement.start, end: statement.end, text: formsText({ forms }) });
}
