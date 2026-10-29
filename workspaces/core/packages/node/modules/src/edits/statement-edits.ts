import { Array, Option } from 'effect';
import { moduleStatements } from '../statements/module-statements.ts';
import type { AddedStatement, DroppedName, ModuleStatement, ParsedSource, TextEdit } from '../types.ts';
import { anchoredStatements } from './anchored-statements.ts';
import { broughtNames } from './brought-names.ts';
import { droppedNameKey } from './dropped-name-key.ts';
import { formsText } from './forms-text.ts';
import { mergedStatements } from './merged-statements.ts';
import { statementEdit } from './statement-edit.ts';
import { statementKey } from './statement-key.ts';

/** The names a rewrite drops from a file's statements, and the statements it adds. */
type StatementRewrite = { readonly dropped: ReadonlyArray<DroppedName>; readonly added: ReadonlyArray<AddedStatement> };

type StatementEditsInput = { readonly source: ParsedSource; readonly rewrite: StatementRewrite };

/**
 * The edits that rewrite a file's statements. Each statement loses its dropped names and absorbs the names of each
 * added one of its kind, type-ness and module; every other added one lands after its anchor. A statement left without a
 * name goes with its line, and a re-export keeps its place, as an entry lists its surface.
 */
export function statementEdits({ source, rewrite }: StatementEditsInput): ReadonlyArray<TextEdit> {
  const statements = moduleStatements({ source });

  /** A statement's start under its key; the first statement of a key wins. */
  const keyedStart: (statement: ModuleStatement) => readonly [string, number] = (statement) => [
    statementKey(statement),
    statement.start,
  ];

  const absorbing = new Map(statements.toReversed().map(keyedStart));

  /** Whether a statement of the file absorbs the added statement. */
  const isAbsorbed: (added: AddedStatement) => boolean = (added) => absorbing.has(statementKey(added));
  /** Whether no statement of the file absorbs the added statement, which then lands after its anchor. */
  const isPlaced: (added: AddedStatement) => boolean = (added) => !absorbing.has(statementKey(added));
  const absorbed = rewrite.added.filter(isAbsorbed);
  const placed = mergedStatements({ added: rewrite.added.filter(isPlaced) });
  const brought = broughtNames({ absorbed, absorbing });
  const anchored = anchoredStatements({ placed, statements });
  const dropped: ReadonlySet<string> = new Set(rewrite.dropped.map((name) => droppedNameKey(name)));

  if (statements.length === 0 && placed.length === 0) {
    return [];
  }

  if (statements.length === 0) {
    return [{ start: 0, end: 0, text: `${formsText({ forms: placed })}\n\n` }];
  }

  /** One statement's edit, with the names it absorbs and the statements that land after it. */
  const edit: (statement: ModuleStatement) => Option.Option<TextEdit> = (statement) =>
    statementEdit({
      text: source.text,
      statement,
      dropped,
      absorbed: Option.getOrElse(Option.fromNullishOr(brought.get(statement.start)), () => []),
      placed: Option.getOrElse(Option.fromNullishOr(anchored.get(statement.start)), () => []),
    });

  return Array.getSomes(statements.map(edit));
}
