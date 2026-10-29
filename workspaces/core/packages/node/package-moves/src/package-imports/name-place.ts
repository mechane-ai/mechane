import { movedPath } from '@mechane/checks-kernel';
import { exportOrigin, StatementKind } from '@mechane/modules';
import type { ModuleName, ModuleStatement } from '@mechane/modules';
import { Option } from 'effect';
import { memberOf } from '../member-of.ts';
import type { NamePlace, SourceContext } from './types.ts';

/** A name a statement takes, and the file before the step that the statement names. */
type NamePlaceInput = {
  readonly context: SourceContext;
  readonly importer: string;
  readonly statement: ModuleStatement;
  readonly name: ModuleName;
  readonly target: string;
};

/** Where a name a statement takes stands after the step, and where the statement and its declaration stand. */
export function namePlace({ context, importer, statement, name, target }: NamePlaceInput): NamePlace {
  const { layout, table, entries } = context;

  const origin = Option.getOrElse(exportOrigin({ table, path: target, name: name.imported }), () => ({
    path: target,
    name: name.imported,
  }));

  const moved = movedPath({ moves: layout.moves, path: importer });
  const importing = memberOf({ layout, path: moved });
  const declaring = movedPath({ moves: layout.moves, path: origin.path });
  const owner = memberOf({ layout, path: declaring });
  const targetMember = memberOf({ layout, path: movedPath({ moves: layout.moves, path: target }) });
  const isRelative = Option.isSome(statement.target);

  return {
    importer: moved,
    target: movedPath({ moves: layout.moves, path: target }),
    importing,
    origin,
    declaring,
    owner,
    isLocal: isRelative && targetMember === importing,
    isStaying: !isRelative && targetMember === owner,
    isDropped: statement.kind === StatementKind.Reexport && [...entries.values()].includes(importer),
  };
}
