import { Array, Option } from 'effect';
import { StatementKind } from '../constants.ts';
import { originKey } from '../origin-key.ts';
import { exportOrigin } from '../statements/export-origin.ts';
import type { FileFacts, ModuleName, ModuleStatement, PlacementIndex } from '../types.ts';

/** The import of a file that binds a name, the name it takes, and the key of what it binds. */
type ImportBinding = { readonly statement: ModuleStatement; readonly name: ModuleName; readonly key: string };

/** An import statement, and the name it takes that binds the name asked for. */
type TakenName = { readonly statement: ModuleStatement; readonly name: ModuleName };

type ImportBindingInput = { readonly index: PlacementIndex; readonly facts: FileFacts; readonly name: string };

/**
 * The import of a file that binds a name: its statement, the name it takes, and the key of what it binds. The key names
 * the declaration it takes through every re-export, or a package's export. None where no import binds the name.
 */
export function importBinding({ index, facts, name }: ImportBindingInput): Option.Option<ImportBinding> {
  const imports = facts.statements.filter(({ kind }) => kind === StatementKind.Import);

  /** The name an import takes that binds `name`, with the import. */
  const takenBy: (statement: ModuleStatement) => Option.Option<TakenName> = (statement) =>
    Option.map(
      Array.findFirst(statement.names, ({ local }) => local === name),
      (taken) => ({ statement, name: taken }),
    );

  const taking = Option.firstSomeOf(imports.map(takenBy));

  if (Option.isNone(taking)) {
    return Option.none();
  }

  const { statement, name: taken } = taking.value;

  const key: string = (() => {
    if (Option.isNone(statement.target)) {
      return originKey({ path: statement.specifier, name: taken.imported });
    }

    const target = statement.target.value;
    const origin = exportOrigin({ table: index.table, path: target, name: taken.imported });

    return originKey(Option.getOrElse(origin, () => ({ path: target, name: taken.imported })));
  })();

  return Option.some({ statement, name: taken, key });
}
