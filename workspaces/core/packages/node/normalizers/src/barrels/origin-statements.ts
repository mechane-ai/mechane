import { InputUnreadable } from '@mechane/checks-kernel';
import { exportOrigin } from '@mechane/modules';
import type { AddedStatement, ExportTable, ModuleName, ModuleStatement, Origin } from '@mechane/modules';
import { relativeSpecifier } from '@mechane/program';
import { Effect, Option } from 'effect';

/** A name a statement takes, and the file and name that declare it. */
type NameOrigin = { readonly name: ModuleName; readonly origin: Origin };

/** A statement, the entry it passes through, the path of its file and every file's exports. */
type OriginStatementsInput = {
  readonly statement: ModuleStatement;
  readonly target: string;
  readonly path: string;
  readonly table: ExportTable;
};

/** A name a statement takes, the entry it takes it through, the path of its file and every file's exports. */
type NameOriginInput = {
  readonly name: ModuleName;
  readonly target: string;
  readonly path: string;
  readonly table: ExportTable;
};

/** The file and name that declare a name a statement takes through an entry. */
const nameOrigin = Effect.fn('nameOrigin')(function* ({
  name,
  target,
  path,
  table,
}: NameOriginInput): Effect.fn.Return<NameOrigin, InputUnreadable> {
  const origin = exportOrigin({ table, path: target, name: name.imported });

  if (Option.isNone(origin)) {
    return yield* new InputUnreadable({
      path,
      reason: `it takes ${name.imported} from ${target}, which declares none`,
    });
  }

  return { name, origin: origin.value };
});

/** The statements that take a statement's names from their declaring files, one per file, in the statement's place. */
export const originStatements = Effect.fn('originStatements')(function* ({
  statement,
  target,
  path,
  table,
}: OriginStatementsInput): Effect.fn.Return<ReadonlyArray<AddedStatement>, InputUnreadable> {
  const origins = yield* Effect.forEach(statement.names, (name) => nameOrigin({ name, target, path, table }), {
    concurrency: 1,
  });

  /** The statement that takes a group of names from the file that declares them, as the replaced statement takes. */
  const declaringStatement: (group: readonly [string, ReadonlyArray<NameOrigin>]) => AddedStatement = ([
    declaring,
    group,
  ]) => ({
    kind: statement.kind,
    isTypeOnly: statement.isTypeOnly,
    specifier: relativeSpecifier({ importer: path, target: declaring }),
    target: Option.some(declaring),
    names: group.map(({ name, origin }) => ({ imported: origin.name, local: name.local })),
    anchor: Option.some(statement.start),
  });

  return [...Map.groupBy(origins, ({ origin }) => origin.path)].map(declaringStatement);
});
