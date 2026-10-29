import type { AddedStatement, DroppedName, ModuleName, ModuleStatement } from '@mechane/modules';
import { Option } from 'effect';
import type { Requirement } from '../packages.types.ts';
import { nameDestination } from './name-destination.ts';
import type { Destination, SourceContext } from './types.ts';

/** The context of a file's rewrite, the file's path before the step, and one of its named statements. */
type StatementInput = {
  readonly context: SourceContext;
  readonly importer: string;
  readonly statement: ModuleStatement;
};

/** A name a statement takes, and where it comes from after the step. */
type NamedDestination = {
  readonly name: ModuleName;
  /** Absent for an entry's re-export of a file that left its member. */
  readonly destination: Option.Option<Destination>;
};

/** A named statement, and where each of its names comes from after the step. */
type AddedStatementsInput = { readonly statement: ModuleStatement; readonly placed: ReadonlyArray<Destination> };

/** What a statement's rewrite drops and adds, and the names it takes from other members' entries. */
export type StatementRewrite = {
  readonly dropped: ReadonlyArray<DroppedName>;
  readonly added: ReadonlyArray<AddedStatement>;
  readonly requirements: ReadonlyArray<Requirement>;
};

/**
 * A named statement's rewrite: none while every name it takes keeps its module. Else it drops every name, and one
 * statement for each module the names come from after the step lands where it stood.
 */
export function statementRewrite({ context, importer, statement }: StatementInput): StatementRewrite {
  /** The name, with where it comes from after the step. */
  const namedDestination: (name: ModuleName) => NamedDestination = (name) => ({
    name,
    destination: nameDestination({ context, importer, statement, name }),
  });

  const destinations = statement.names.map(namedDestination);

  /** Whether the name keeps its module and its name. */
  const isKeptName: (named: NamedDestination) => boolean = ({ name, destination }) =>
    Option.exists(destination, (kept) => kept.specifier === statement.specifier && kept.name === name);

  const isKept = destinations.every(isKeptName);

  if (isKept) {
    return { dropped: [], added: [], requirements: [] };
  }

  const placed = destinations.flatMap(({ destination }) => Option.toArray(destination));

  return {
    dropped: statement.names.map(({ local }) => ({ start: statement.start, local })),
    added: addedStatements({ statement, placed }),
    requirements: placed.flatMap(({ requirement }) => Option.toArray(requirement)),
  };
}

/** One statement for each module the names come from after the step, each landing where the statement stood. */
function addedStatements({ statement, placed }: AddedStatementsInput): ReadonlyArray<AddedStatement> {
  const modules = Map.groupBy(placed, ({ specifier }) => specifier);

  /** The statement that takes one module's names. */
  const addedStatement: (group: readonly [string, ReadonlyArray<Destination>]) => AddedStatement = ([
    specifier,
    group,
  ]) => ({
    kind: statement.kind,
    isTypeOnly: statement.isTypeOnly,
    specifier,
    target: Option.none(),
    names: group.map(({ name }) => name),
    anchor: Option.some(statement.start),
  });

  return [...modules].map(addedStatement);
}
