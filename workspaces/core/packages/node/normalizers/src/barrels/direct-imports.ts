import type { FileChange, InputUnreadable } from '@mechane/checks-kernel';
import { editedText, moduleStatements, statementEdits } from '@mechane/modules';
import type { DroppedName, ExportTable, ModuleStatement, NormalizerScope, ParsedSource } from '@mechane/modules';
import { Effect, Option } from 'effect';
import { entryTarget } from './entry-target.ts';
import { joinedStatements } from './joined-statements.ts';
import { originStatements } from './origin-statements.ts';

/** A file that stays, the barrels that go, the entries, the scope and every file's exports. */
type DirectImportsInput = {
  readonly source: ParsedSource;
  readonly barrels: ReadonlySet<string>;
  readonly entries: ReadonlyMap<string, string>;
  readonly scope: NormalizerScope;
  readonly table: ExportTable;
};

/** A statement that passes through an entry, and that entry. */
type PassingStatement = { readonly statement: ModuleStatement; readonly target: string };

/** A file that stays, the barrels that go, the entries and the scope. */
type PassingStatementsInput = {
  readonly source: ParsedSource;
  readonly barrels: ReadonlySet<string>;
  readonly entries: ReadonlyMap<string, string>;
  readonly scope: NormalizerScope;
};

/**
 * The file with each statement that takes names through a barrel, or through its own library's entry, taking them from
 * their declaring files in its place. It is none for a file without such a statement.
 */
export const directImports = Effect.fn('directImports')(function* ({
  source,
  barrels,
  entries,
  scope,
  table,
}: DirectImportsInput): Effect.fn.Return<Option.Option<FileChange>, InputUnreadable> {
  const passing = passingStatements({ source, barrels, entries, scope });

  if (passing.length === 0) {
    return Option.none();
  }

  const added = yield* Effect.forEach(
    passing,
    ({ statement, target }) => originStatements({ statement, target, path: source.path, table }),
    { concurrency: 1 },
  );

  /** Every name a statement takes, which its replacements take instead. */
  const droppedNames: (passed: PassingStatement) => ReadonlyArray<DroppedName> = ({ statement }) =>
    statement.names.map(({ local }) => ({ start: statement.start, local }));

  const rewrite = { dropped: passing.flatMap(droppedNames), added: joinedStatements({ statements: added.flat() }) };
  const edits = statementEdits({ source, rewrite });

  return Option.some({ path: source.path, text: Option.some(editedText({ text: source.text, edits })) });
});

/** Each statement of the file that passes through an entry, with that entry. */
function passingStatements({
  source,
  barrels,
  entries,
  scope,
}: PassingStatementsInput): ReadonlyArray<PassingStatement> {
  /** The statement with the entry it passes through; none when it passes through none. */
  const passingOf: (statement: ModuleStatement) => ReadonlyArray<PassingStatement> = (statement) =>
    Option.toArray(entryTarget({ statement, path: source.path, barrels, entries, scope })).map((target) => ({
      statement,
      target,
    }));

  return moduleStatements({ source }).flatMap(passingOf);
}
