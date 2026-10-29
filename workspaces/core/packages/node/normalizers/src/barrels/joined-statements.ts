import type { AddedStatement } from '@mechane/modules';
import { Array, Option } from 'effect';

type JoinedStatementsInput = { readonly statements: ReadonlyArray<AddedStatement> };

/** The added statements, each kind's statements that take names from one file joined into the first of them. */
export function joinedStatements({ statements }: JoinedStatementsInput): ReadonlyArray<AddedStatement> {
  /** What joins two statements: their kind, whether they take types only, and the module they name. */
  const statementJoinKey: (statement: AddedStatement) => string = ({ kind, isTypeOnly, specifier }) =>
    `${kind} ${String(isTypeOnly)} ${specifier}`;

  /** A group's first statement, with every name of the group in order. */
  const joined: (group: ReadonlyArray<AddedStatement>) => ReadonlyArray<AddedStatement> = (group) => {
    const names = group.flatMap((statement) => statement.names);

    return Option.toArray(Array.head(group)).map((first) => ({ ...first, names }));
  };

  return [...Map.groupBy(statements, statementJoinKey).values()].flatMap(joined);
}
